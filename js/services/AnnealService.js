class AnnealService {
    constructor() {
        this.worker = null;

        // Callbacks — set by consumer
        this.onProgress = null; // (minimalSolution) => void — visual progress during annealing
        this.onResult = null;   // (result) => void — {finalSolution, cellular, metadata}
        this.onError = null;    // (error) => void — {message}
    }

    initialize() {
        try {
            this.worker = new Worker('js/workers/solution-worker.js');

            this.worker.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                if (this.onError) this.onError(error);
            };
            // Initialize worker in single mode
            this.worker.postMessage({
                type: 'SET_MODE',
                payload: { mode: 'single', config: {} }
            });
        } catch (error) {
            console.error('Failed to initialize solution worker:', error);
            this.worker = null;
        }
    }

    generate(shapesData, config) {
        if (!this.worker) {
            throw new Error('Solution worker is not available.');
        }

        this.worker.postMessage({
            type: 'GENERATE_SOLUTION',
            payload: {
                shapes: shapesData,
                jobId: `single-${Date.now()}`,
                startId: 0,
                aspectRatioPref: config.aspectRatioPref,
                useCustomPerimeter: config.useCustomPerimeter,
                perimeterWidthInches: config.perimeterWidthInches,
                perimeterHeightInches: config.perimeterHeightInches,
                customBufferSize: config.customBufferSize,
                centerShape: config.centerShape,
                minWallLength: config.minWallLength
            }
        });
    }

    stop() {
        if (this.worker) {
            this.worker.terminate();
            this.initialize();
        }
    }

    handleMessage(data) {
        const { type, payload } = data;

        switch (type) {
            case 'MODE_SET':
                console.log('Worker mode set:', payload.mode);
                break;
            case 'PROGRESS':
                this.handleProgress(payload);
                break;
            case 'RESULT':
                if (this.onResult) this.onResult(payload);
                break;
            case 'ERROR':
                if (this.onError) this.onError(payload);
                break;
            default:
                console.warn('Unknown worker message type:', type);
        }
    }

    handleProgress(progress) {
        const { progressType, mode, phase, message, score, valid, visualData } = progress;

        switch (progressType) {
            case 'PHASE_START':
                console.log(`Starting ${phase}: ${message}`);
                break;
            case 'ANNEAL_PROGRESS':
                if (mode === 'single' && visualData && this.onProgress) {
                    const minimalSolution = {
                        layout: visualData.layout,
                        shapes: visualData.shapes,
                        score: score,
                        valid: valid,
                        useCustomPerimeter: visualData.useCustomPerimeter,
                        perimeterWidthInches: visualData.perimeterWidthInches,
                        perimeterHeightInches: visualData.perimeterHeightInches,
                        goalPerimeterGrid: visualData.goalPerimeterGrid,
                        minWallLength: visualData.minWallLength
                    };
                    this.onProgress(minimalSolution);
                } else if (!visualData) {
                    console.log(`Annealing progress: score=${score}, valid=${valid}, mode=${mode}`);
                }
                break;
            case 'PHASE_COMPLETE':
                console.log(`Completed ${phase}:`, progress);
                break;
        }
    }
}
