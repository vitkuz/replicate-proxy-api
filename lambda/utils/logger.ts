import { Context } from 'aws-lambda';

interface LogContext {
    requestId?: string;
    functionName?: string;
    jobId?: string;
    action?: string;
}

interface LogEntry {
    timestamp: string;
    level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
    message: string;
    context: LogContext;
    data?: Record<string, unknown>;
    error?: {
        name?: string;
        message?: string;
        stack?: string;
        [key: string]: unknown;
    };
}

export class Logger {
    private context: LogContext;

    constructor(context: Partial<LogContext> = {}) {
        this.context = context;
    }

    private log(level: LogEntry['level'], message: string, data?: Record<string, unknown>, error?: unknown): void {
        const logEntry: Partial<LogEntry> = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: this.context,
        };

        if (data) {
            logEntry.data = data;
        }

        if (error) {
            logEntry.error = this.formatError(error);
        }

        console.log(JSON.stringify(logEntry as LogEntry));
    }

    private formatError(error: unknown): LogEntry['error'] {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        return { message: String(error) };
    }

    withContext(additionalContext: Partial<LogContext>): Logger {
        return new Logger({ ...this.context, ...additionalContext });
    }

    info(message: string, data?: Record<string, unknown>): void {
        this.log('INFO', message, data);
    }

    error(message: string, error?: unknown, data?: Record<string, unknown>): void {
        this.log('ERROR', message, data, error);
    }

    warn(message: string, data?: Record<string, unknown>): void {
        this.log('WARN', message, data);
    }

    debug(message: string, data?: Record<string, unknown>): void {
        this.log('DEBUG', message, data);
    }
}