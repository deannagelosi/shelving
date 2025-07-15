class BulkResultsRepository {
    constructor(state) {
        this.state = state;
    }

    async initSqlJs() {
        try {
            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });
            window.SQL = SQL;
            return true;
        } catch (error) {
            console.error("Failed to load SQL.js:", error);
            return false;
        }
    }

    loadDbFromBuffer(arrayBuffer) {
        try {
            const uInt8Array = new Uint8Array(arrayBuffer);
            this.state.database = new window.SQL.Database(uInt8Array);
            return true;
        } catch (error) {
            console.error("Failed to load database from buffer:", error);
            this.state.database = null;
            return false;
        }
    }

    getJobs() {
        if (!this.state.database) return [];

        try {
            const stmt = this.state.database.prepare('SELECT * FROM bulk_jobs ORDER BY created_at DESC');
            const jobs = [];
            while (stmt.step()) {
                jobs.push(stmt.getAsObject());
            }
            stmt.free();
            this.state.jobs = jobs;
            return jobs;
        } catch (error) {
            console.error("Failed to load jobs:", error);
            return [];
        }
    }

    getSolutionsForJob(jobId) {
        if (!this.state.database) return [];

        try {
            const stmt = this.state.database.prepare(`
                SELECT solution_id, start_id, score, valid, 
                       baseline_grid_json, stats_breakdown_json,
                       export_data_json, cellular_json,
                       board_render_data_optimized
                FROM solutions 
                WHERE job_id = ? 
                ORDER BY start_id
            `);
            stmt.bind([jobId]);

            const solutions = [];
            while (stmt.step()) {
                solutions.push(stmt.getAsObject());
            }
            stmt.free();
            this.state.solutions = solutions;
            return solutions;
        } catch (error) {
            console.error(`Failed to load solutions for job ${jobId}:`, error);
            return [];
        }
    }
} 