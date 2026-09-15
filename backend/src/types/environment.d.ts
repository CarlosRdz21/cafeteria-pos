declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      NODE_ENV?: 'development' | 'production' | 'test';
      DATABASE_URL?: string;
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;
      FRONTEND_ORIGINS?: string;
      JSON_BODY_LIMIT?: string;
      LOGIN_RATE_LIMIT_WINDOW_MS?: string;
      LOGIN_RATE_LIMIT_MAX?: string;
      AUTH_DEBUG_TOKEN?: string;
      CLONE_READ_ONLY?: string;
      MP_ACCESS_TOKEN?: string;
      MP_SUCCESS_URL?: string;
      MP_PENDING_URL?: string;
      MP_FAILURE_URL?: string;
      MP_AUTO_RETURN?: string;
      MP_POINT_TERMINAL_ID?: string;
      MP_POINT_TERMINAL_SERIAL?: string;
      MP_POINT_STORE_ID?: string;
      MP_POINT_POS_ID?: string;
      MP_POINT_PRINT_ON_TERMINAL?: string;
    }
  }
}

export {};
