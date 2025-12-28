import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import http from 'http';

export class PythonManager {
    private process: ChildProcess | null = null;
    private backendUrl: string = 'http://127.0.0.1:18000';
    private isBackendRunning: boolean = false;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor() { }

    /**
     * Get the path to the Python backend executable or script
     */
    private getBackendPath(): string {
        const isDev = !app.isPackaged;

        if (isDev) {
            // Development: use the Python script directly
            return path.join(app.getAppPath(), '..', 'backend');
        } else {
            // Production: use the bundled backend
            return path.join(process.resourcesPath, 'backend');
        }
    }

    /**
     * Get the Python executable path
     */
    private getPythonPath(): string {
        const isDev = !app.isPackaged;

        if (isDev) {
            // Development: use system Python or conda environment
            return process.platform === 'win32' ? 'python' : 'python3';
        } else {
            // Production: use bundled Python (if using PyInstaller) or system Python
            const backendPath = this.getBackendPath();

            if (process.platform === 'win32') {
                // Check for PyInstaller bundled executable
                return path.join(backendPath, 'vidgo-backend.exe');
            } else {
                return path.join(backendPath, 'vidgo-backend');
            }
        }
    }

    /**
     * Start the Python backend
     */
    async start(): Promise<void> {
        if (this.process) {
            console.log('Python backend is already running');
            return;
        }

        const isDev = !app.isPackaged;
        const backendPath = this.getBackendPath();

        return new Promise((resolve, reject) => {
            try {
                if (isDev) {
                    // Development: run Django dev server
                    const pythonPath = this.getPythonPath();
                    const managePy = path.join(backendPath, 'manage.py');

                    console.log(`Starting Django dev server: ${pythonPath} ${managePy} runserver`);

                    this.process = spawn(pythonPath, ['manage.py', 'runserver', '127.0.0.1:18000', '--noreload'], {
                        cwd: backendPath,
                        env: {
                            ...process.env,
                            PYTHONUNBUFFERED: '1',
                        },
                        shell: true,
                    });
                } else {
                    // Production: run PyInstaller bundled executable
                    const executablePath = this.getPythonPath();

                    console.log(`Starting bundled backend: ${executablePath}`);

                    this.process = spawn(executablePath, [], {
                        cwd: backendPath,
                        env: {
                            ...process.env,
                        },
                    });
                }

                // Handle process output
                this.process.stdout?.on('data', (data) => {
                    console.log(`[Backend] ${data.toString()}`);
                });

                this.process.stderr?.on('data', (data) => {
                    console.error(`[Backend Error] ${data.toString()}`);
                });

                this.process.on('error', (error) => {
                    console.error('Failed to start Python backend:', error);
                    this.isBackendRunning = false;
                    reject(error);
                });

                this.process.on('exit', (code) => {
                    console.log(`Python backend exited with code ${code}`);
                    this.isBackendRunning = false;
                    this.process = null;
                });

                // Wait for backend to be ready
                this.waitForBackend()
                    .then(() => {
                        this.isBackendRunning = true;
                        this.startHealthCheck();
                        resolve();
                    })
                    .catch((error) => {
                        reject(error);
                    });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Wait for the backend to respond to health checks
     */
    private async waitForBackend(maxAttempts: number = 30, interval: number = 1000): Promise<void> {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const isHealthy = await this.checkHealth();
                if (isHealthy) {
                    console.log('Backend is ready!');
                    return;
                }
            } catch {
                // Ignore errors, keep trying
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }

        throw new Error('Backend failed to start within timeout');
    }

    /**
     * Check if the backend is healthy
     */
    private checkHealth(): Promise<boolean> {
        return new Promise((resolve) => {
            const req = http.get(`${this.backendUrl}/api/health/`, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.setTimeout(2000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Start periodic health checks
     */
    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(async () => {
            const isHealthy = await this.checkHealth();
            if (!isHealthy && this.isBackendRunning) {
                console.warn('Backend health check failed');
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop the Python backend
     */
    async stop(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (!this.process) {
            return;
        }

        return new Promise((resolve) => {
            if (!this.process) {
                resolve();
                return;
            }

            this.process.on('exit', () => {
                this.process = null;
                this.isBackendRunning = false;
                resolve();
            });

            // Send SIGTERM to gracefully stop
            if (process.platform === 'win32') {
                // On Windows, use taskkill
                spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
            } else {
                this.process.kill('SIGTERM');
            }

            // Force kill after timeout
            setTimeout(() => {
                if (this.process) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        });
    }

    /**
     * Check if the backend is running
     */
    isRunning(): boolean {
        return this.isBackendRunning;
    }

    /**
     * Get the backend URL
     */
    getBackendUrl(): string {
        return this.backendUrl;
    }
}
