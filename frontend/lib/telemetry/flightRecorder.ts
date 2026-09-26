/**
 * SchoolOS Flight Recorder - Client-Side Diagnostic Telemetry Engine
 * 
 * Lightweight in-memory circular ring buffer holding recent user actions,
 * network/API errors, console logs, unhandled exceptions, and environment context.
 * Zero continuous network overhead - snapshot bundled only when user submits a support report.
 */

export interface TelemetryBreadcrumb {
  type: 'navigation' | 'click' | 'network_error' | 'console_error' | 'console_warn' | 'exception' | 'custom';
  timestamp: string;
  category: string;
  message: string;
  data?: any;
}

export interface DiagnosticBundle {
  session_id: string;
  generated_at: string;
  current_route: string;
  user_context: {
    id?: string | number;
    email?: string;
    role?: string;
    name?: string;
    school_id?: string | number;
    school_name?: string;
  };
  device_context: {
    user_agent: string;
    browser: string;
    os: string;
    screen_resolution: string;
    viewport_size: string;
    device_pixel_ratio: number;
    language: string;
    timezone: string;
    online_status: boolean;
    connection_type?: string;
  };
  recent_errors: Array<{
    type: string;
    message: string;
    stack?: string;
    timestamp: string;
  }>;
  recent_failed_requests: Array<{
    url: string;
    method: string;
    status: number;
    status_text?: string;
    duration_ms?: number;
    response_preview?: string;
    timestamp: string;
  }>;
  breadcrumbs: TelemetryBreadcrumb[];
}

class FlightRecorderEngine {
  private bufferSize: number = 150;
  private breadcrumbs: TelemetryBreadcrumb[] = [];
  private recentErrors: Array<{ type: string; message: string; stack?: string; timestamp: string }> = [];
  private failedRequests: Array<{ url: string; method: string; status: number; status_text?: string; duration_ms?: number; response_preview?: string; timestamp: string }> = [];
  private isInitialized: boolean = false;
  private sessionId: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionId = this.getOrCreateSessionId();
    }
  }

  private getOrCreateSessionId(): string {
    try {
      let sid = sessionStorage.getItem('schoolos_flight_session');
      if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        sessionStorage.setItem('schoolos_flight_session', sid);
      }
      return sid;
    } catch {
      return 'sess_' + Math.random().toString(36).substring(2, 10);
    }
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    this.installConsoleInterceptors();
    this.installGlobalErrorHandlers();
    this.installNavigationTracker();
    this.installDOMClickTracker();
    
    this.addBreadcrumb({
      type: 'custom',
      category: 'telemetry',
      message: 'FlightRecorder initialized successfully'
    });
  }

  public addBreadcrumb(breadcrumb: Omit<TelemetryBreadcrumb, 'timestamp'>) {
    const item: TelemetryBreadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString(),
      data: this.sanitizeData(breadcrumb.data)
    };

    this.breadcrumbs.push(item);
    if (this.breadcrumbs.length > this.bufferSize) {
      this.breadcrumbs.shift();
    }
  }

  public recordFailedRequest(req: { url: string; method: string; status: number; status_text?: string; duration_ms?: number; response_preview?: any }) {
    const item = {
      url: req.url,
      method: req.method,
      status: req.status,
      status_text: req.status_text,
      duration_ms: req.duration_ms,
      response_preview: typeof req.response_preview === 'string' 
        ? req.response_preview.substring(0, 300) 
        : JSON.stringify(this.sanitizeData(req.response_preview))?.substring(0, 300),
      timestamp: new Date().toISOString()
    };

    this.failedRequests.push(item);
    if (this.failedRequests.length > 30) {
      this.failedRequests.shift();
    }

    this.addBreadcrumb({
      type: 'network_error',
      category: 'api',
      message: `API ${req.method} ${req.url} failed with HTTP ${req.status}`,
      data: item
    });
  }

  private installConsoleInterceptors() {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      try {
        const message = args.map(a => (typeof a === 'object' ? JSON.stringify(this.sanitizeData(a)) : String(a))).join(' ');
        this.recentErrors.push({
          type: 'console_error',
          message: message.substring(0, 500),
          timestamp: new Date().toISOString()
        });
        if (this.recentErrors.length > 30) this.recentErrors.shift();

        this.addBreadcrumb({
          type: 'console_error',
          category: 'console',
          message: message.substring(0, 200)
        });
      } catch {}
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      try {
        const message = args.map(a => (typeof a === 'object' ? JSON.stringify(this.sanitizeData(a)) : String(a))).join(' ');
        this.addBreadcrumb({
          type: 'console_warn',
          category: 'console',
          message: message.substring(0, 200)
        });
      } catch {}
      originalWarn.apply(console, args);
    };
  }

  private installGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      try {
        const errorObj = {
          type: 'uncaught_exception',
          message: event.message || 'Unknown runtime error',
          stack: event.error?.stack ? String(event.error.stack).substring(0, 1000) : `${event.filename}:${event.lineno}:${event.colno}`,
          timestamp: new Date().toISOString()
        };
        this.recentErrors.push(errorObj);
        if (this.recentErrors.length > 30) this.recentErrors.shift();

        this.addBreadcrumb({
          type: 'exception',
          category: 'runtime',
          message: `Uncaught Error: ${event.message}`,
          data: { filename: event.filename, lineno: event.lineno }
        });
      } catch {}
    });

    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason = event.reason;
        const message = reason?.message || String(reason) || 'Unhandled Promise Rejection';
        const stack = reason?.stack ? String(reason.stack).substring(0, 1000) : '';

        const errorObj = {
          type: 'unhandled_rejection',
          message: message.substring(0, 500),
          stack: stack,
          timestamp: new Date().toISOString()
        };
        this.recentErrors.push(errorObj);
        if (this.recentErrors.length > 30) this.recentErrors.shift();

        this.addBreadcrumb({
          type: 'exception',
          category: 'promise',
          message: `Unhandled Rejection: ${message}`
        });
      } catch {}
    });
  }

  private installNavigationTracker() {
    const recordNav = () => {
      this.addBreadcrumb({
        type: 'navigation',
        category: 'route',
        message: `Navigated to ${window.location.pathname}${window.location.search}`
      });
    };

    window.addEventListener('popstate', recordNav);

    // Patch pushState & replaceState
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    history.pushState = function (...args) {
      origPush.apply(this, args);
      recordNav();
    };

    history.replaceState = function (...args) {
      origReplace.apply(this, args);
      recordNav();
    };
  }

  private installDOMClickTracker() {
    document.addEventListener('click', (event) => {
      try {
        const target = event.target as HTMLElement;
        if (!target) return;

        const button = target.closest('button, a, input[type="button"], input[type="submit"]');
        if (button) {
          const text = (button.textContent || (button as HTMLInputElement).value || button.getAttribute('aria-label') || '').trim();
          const tag = button.tagName.toLowerCase();
          const identifier = button.id ? `#${button.id}` : (button.className ? `.${button.className.split(' ')[0]}` : '');
          
          this.addBreadcrumb({
            type: 'click',
            category: 'ui',
            message: `Clicked <${tag}${identifier}> "${text.substring(0, 40)}"`,
          });
        }
      } catch {}
    }, { capture: true, passive: true });
  }

  private parseEnvironment() {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    return {
      user_agent: ua,
      browser,
      os,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      device_pixel_ratio: window.devicePixelRatio || 1,
      language: navigator.language || 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      online_status: navigator.onLine,
      connection_type: (navigator as any).connection?.effectiveType || 'unknown'
    };
  }

  private getUserContext() {
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        return {
          id: u.id,
          email: u.email,
          role: u.role || u.user_type,
          name: u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : (u.name || u.email),
          school_id: u.school_id || u.school?.id,
          school_name: u.school_name || u.school?.name || u.school?.display_name
        };
      }
    } catch {}
    return {};
  }

  private sanitizeData(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') {
      if (obj.length > 500) return obj.substring(0, 500) + '...[truncated]';
      return obj;
    }
    if (typeof obj !== 'object') return obj;

    const sensitiveKeys = ['password', 'token', 'access_token', 'refresh_token', 'authorization', 'secret', 'key', 'credit_card', 'card'];
    const cleaned: any = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          cleaned[key] = '[REDACTED_SENSITIVE_DATA]';
        } else {
          cleaned[key] = this.sanitizeData(obj[key]);
        }
      }
    }
    return cleaned;
  }

  public getDiagnosticBundle(): DiagnosticBundle {
    return {
      session_id: this.sessionId,
      generated_at: new Date().toISOString(),
      current_route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
      user_context: this.getUserContext(),
      device_context: typeof window !== 'undefined' ? this.parseEnvironment() : ({} as any),
      recent_errors: [...this.recentErrors],
      recent_failed_requests: [...this.failedRequests],
      breadcrumbs: [...this.breadcrumbs]
    };
  }
}

// Global singleton instance
export const FlightRecorder = new FlightRecorderEngine();
