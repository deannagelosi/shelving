const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Result.js - SQLite database model for bulk analysis results
 * 
 * Handles all database operations for bulk CLI tool including:
 * - Bulk job tracking and management
 * - Solution result storage with JSON data and indexed metrics
 * - Error collection and logging
 * - Statistical analysis queries
 */
class Result {
    constructor(dbPath = null) {
        // Default to results.sqlite in the models directory
        this.dbPath = dbPath || path.join(__dirname, 'results.sqlite');
        this.db = null;
    }

    /**
     * Initialize database connection and create tables if they don't exist
     */
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(new Error(`Failed to connect to database: ${err.message}`));
                    return;
                }

                console.log(`Connected to SQLite database: ${this.dbPath}`);
                this._createTables()
                    .then(resolve)
                    .catch(reject);
            });
        });
    }

    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err) => {
                if (err) {
                    reject(new Error(`Failed to close database: ${err.message}`));
                } else {
                    console.log('Database connection closed');
                    this.db = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Execute a single SQL statement and return a promise
     */
    async _runSql(sql, errorMessage) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, (err) => {
                if (err) {
                    reject(new Error(`${errorMessage}: ${err.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Create database tables based on schema design
     */
    async _createTables() {
        const createBulkJobsTable = `
            CREATE TABLE IF NOT EXISTS bulk_jobs (
                job_id TEXT PRIMARY KEY,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                total_workers INTEGER NOT NULL,
                completed_workers INTEGER DEFAULT 0,
                failed_workers INTEGER DEFAULT 0,
                config_json TEXT NOT NULL,
                input_shapes_json TEXT NOT NULL,
                status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
            )
        `;

        const createSolutionsTable = `
            CREATE TABLE IF NOT EXISTS solutions (
                solution_id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                start_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                export_data_json TEXT NOT NULL,
                cellular_json TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                score REAL NOT NULL,
                valid BOOLEAN NOT NULL,
                FOREIGN KEY (job_id) REFERENCES bulk_jobs (job_id)
            )
        `;

        const createSolutionErrorsTable = `
            CREATE TABLE IF NOT EXISTS solution_errors (
                error_id TEXT PRIMARY KEY,
                job_id TEXT NOT NULL,
                start_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_message TEXT NOT NULL,
                error_stack TEXT,
                worker_payload_json TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES bulk_jobs (job_id)
            )
        `;

        // Create indexes for common queries
        const createIndexes = [
            `CREATE INDEX IF NOT EXISTS idx_solutions_job_id ON solutions (job_id)`,
            `CREATE INDEX IF NOT EXISTS idx_solutions_score ON solutions (score)`,
            `CREATE INDEX IF NOT EXISTS idx_solutions_valid ON solutions (valid)`,
            `CREATE INDEX IF NOT EXISTS idx_solution_errors_job_id ON solution_errors (job_id)`,
            `CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status ON bulk_jobs (status)`,
            `CREATE INDEX IF NOT EXISTS idx_bulk_jobs_created_at ON bulk_jobs (created_at)`
        ];

        // Create tables first
        await Promise.all([
            this._runSql(createBulkJobsTable, 'Failed to create bulk_jobs table'),
            this._runSql(createSolutionsTable, 'Failed to create solutions table'),
            this._runSql(createSolutionErrorsTable, 'Failed to create solution_errors table')
        ]);

        // Create indexes after tables exist
        await Promise.all(
            createIndexes.map(indexSql =>
                this._runSql(indexSql, 'Failed to create index')
            )
        );
    }

    /**
     * Create a new bulk job
     */
    async createBulkJob(config, inputShapes, totalWorkers) {
        const jobId = uuidv4();

        const sql = `
            INSERT INTO bulk_jobs (job_id, total_workers, config_json, input_shapes_json)
            VALUES (?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [
                jobId,
                totalWorkers,
                JSON.stringify(config),
                JSON.stringify(inputShapes)
            ], function (err) {
                if (err) {
                    reject(new Error(`Failed to create bulk job: ${err.message}`));
                } else {
                    resolve(jobId);
                }
            });
        });
    }

    /**
     * Update bulk job progress
     */
    async updateBulkJobProgress(jobId, completedWorkers, failedWorkers) {
        const sql = `
            UPDATE bulk_jobs 
            SET completed_workers = ?, failed_workers = ?
            WHERE job_id = ?
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [completedWorkers, failedWorkers, jobId], function (err) {
                if (err) {
                    reject(new Error(`Failed to update bulk job progress: ${err.message}`));
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Complete a bulk job
     */
    async completeBulkJob(jobId, status = 'completed') {
        const sql = `
            UPDATE bulk_jobs 
            SET completed_at = CURRENT_TIMESTAMP, status = ?
            WHERE job_id = ?
        `;

        return new Promise((resolve, reject) => {
            this.db.run(sql, [status, jobId], function (err) {
                if (err) {
                    reject(new Error(`Failed to complete bulk job: ${err.message}`));
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Execute a batch operation within a database transaction
     */
    async _executeTransaction(items, sql, prepareData, validateItem, errorMessage) {
        if (!items || items.length === 0) {
            return [];
        }

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');

                const stmt = this.db.prepare(sql);
                const savedIds = [];

                let completed = 0;
                let hasError = false;

                // Validate all items before starting
                for (const item of items) {
                    if (!validateItem(item)) {
                        stmt.finalize();
                        this.db.run('ROLLBACK');
                        reject(new Error(errorMessage));
                        return;
                    }
                }

                if (items.length === 0) {
                    stmt.finalize();
                    this.db.run('COMMIT');
                    resolve([]);
                    return;
                }

                items.forEach((item) => {
                    const itemId = uuidv4();
                    savedIds.push(itemId);

                    const data = prepareData(item, itemId);

                    stmt.run(data, (err) => {
                        if (err && !hasError) {
                            hasError = true;
                            stmt.finalize();
                            this.db.run('ROLLBACK');
                            reject(new Error(`Failed to save batch: ${err.message}`));
                            return;
                        }

                        completed++;
                        if (completed === items.length && !hasError) {
                            stmt.finalize();
                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    reject(new Error(`Failed to commit batch: ${err.message}`));
                                } else {
                                    resolve(savedIds);
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    /**
     * Save multiple solutions in a single transaction
     */
    async saveSolutionBatch(solutions, inputShapes) {
        const sql = `
            INSERT INTO solutions (
                solution_id, job_id, start_id, export_data_json, 
                cellular_json, metadata_json, score, valid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const validateItem = (result) => {
            return result.result && result.result.finalSolution;
        };

        const prepareData = (result, solutionId) => {
            // Create export format structure for export_data_json
            const exportFormat = {
                savedAnneals: [{
                    title: result.result.title || `solution-${result.startId + 1}`,
                    finalSolution: result.result.finalSolution,
                    enabledShapes: inputShapes.map(() => true), // All shapes enabled in bulk runs
                    solutionHistory: [] // Empty for bulk runs
                }],
                allShapes: inputShapes
            };

            return [
                solutionId,
                result.jobId,
                result.startId,
                JSON.stringify(exportFormat),
                JSON.stringify(result.result.cellular),
                JSON.stringify(result.result.metadata),
                result.result.finalSolution.score,
                result.result.finalSolution.valid ? 1 : 0
            ];
        };

        return this._executeTransaction(
            solutions,
            sql,
            prepareData,
            validateItem,
            'Missing required field: result.finalSolution'
        );
    }

    /**
     * Save multiple errors in a single transaction
     */
    async saveErrorBatch(errors) {
        const sql = `
            INSERT INTO solution_errors (
                error_id, job_id, start_id, error_message, 
                error_stack, worker_payload_json
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const validateItem = (errorData) => {
            return errorData.error && errorData.error.message;
        };

        const prepareData = (errorData, errorId) => {
            return [
                errorId,
                errorData.jobId,
                errorData.startId,
                errorData.error.message,
                errorData.error.stack || null,
                JSON.stringify(errorData.workerPayload)
            ];
        };

        return this._executeTransaction(
            errors,
            sql,
            prepareData,
            validateItem,
            'Missing required field: error.message'
        );
    }
}

module.exports = Result; 