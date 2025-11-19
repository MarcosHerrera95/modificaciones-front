// vite.config.js
import { defineConfig } from "file:///D:/modificaciones-front/changanet/changanet-frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/modificaciones-front/changanet/changanet-frontend/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react", "react-dom"]
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
    pool: "threads",
    server: {
      deps: {
        inline: ["@sentry/browser", "@sentry/react", "react", "react-dom"]
      }
    }
  },
  server: {
    host: "localhost",
    port: 5175,
    deps: {
      inline: ["react", "react-dom"]
    },
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:3003",
        changeOrigin: true,
        secure: false
      },
      "/health": {
        target: process.env.VITE_BACKEND_URL || "http://localhost:3003",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxtb2RpZmljYWNpb25lcy1mcm9udFxcXFxjaGFuZ2FuZXRcXFxcY2hhbmdhbmV0LWZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxtb2RpZmljYWNpb25lcy1mcm9udFxcXFxjaGFuZ2FuZXRcXFxcY2hhbmdhbmV0LWZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9tb2RpZmljYWNpb25lcy1mcm9udC9jaGFuZ2FuZXQvY2hhbmdhbmV0LWZyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7LyoqXHJcbiAqIENvbmZpZ3VyYWNpXHUwMEYzbiBkZSBWaXRlIHBhcmEgZWwgZnJvbnRlbmQgZGUgQ2hhbmdcdTAwRTFuZXQuXHJcbiAqIENvbmZpZ3VyYSBlbCBzZXJ2aWRvciBkZSBkZXNhcnJvbGxvIGNvbiBwcm94eSBwYXJhIEFQSXMgYmFja2VuZCB5IGhlYWRlcnMgZGUgc2VndXJpZGFkIHJlbGFqYWRvcyBwYXJhIGRlc2Fycm9sbG8uXHJcbiAqL1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXHJcblxyXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICBpbmNsdWRlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddXHJcbiAgfSxcclxuICB0ZXN0OiB7XHJcbiAgICBnbG9iYWxzOiB0cnVlLFxyXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXHJcbiAgICBzZXR1cEZpbGVzOiBbJy4vc3JjL3Rlc3Qvc2V0dXAuanMnXSxcclxuICAgIGluY2x1ZGU6IFsnKiovKi57dGVzdCxzcGVjfS57anMsbWpzLGNqcyx0cyxtdHMsY3RzLGpzeCx0c3h9J10sXHJcbiAgICBleGNsdWRlOiBbJ25vZGVfbW9kdWxlcycsICdkaXN0JywgJy5pZGVhJywgJy5naXQnLCAnLmNhY2hlJ10sXHJcbiAgICBwb29sOiAndGhyZWFkcycsXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgZGVwczoge1xyXG4gICAgICAgIGlubGluZTogWydAc2VudHJ5L2Jyb3dzZXInLCAnQHNlbnRyeS9yZWFjdCcsICdyZWFjdCcsICdyZWFjdC1kb20nXVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxyXG4gICAgcG9ydDogNTE3NSxcclxuICAgIGRlcHM6IHtcclxuICAgICAgaW5saW5lOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddXHJcbiAgICB9LFxyXG4gICAgaGVhZGVyczoge1xyXG4gICAgICAvLyBIZWFkZXJzIGRlIGRlc2Fycm9sbG8gLSBDU1AgbW92aWRhIGEgbWV0YSB0YWcgZW4gSFRNTCBwYXJhIG1lam9yIGNvbnRyb2xcclxuICAgICAgLy8gQ09PUC9DT0VQIGRlc2hhYmlsaXRhZG9zIHBhcmEgY29tcGF0aWJpbGlkYWQgY29uIEZpcmViYXNlIEF1dGhcclxuICAgICAgJ0Nyb3NzLU9yaWdpbi1PcGVuZXItUG9saWN5JzogJ3Vuc2FmZS1ub25lJyxcclxuICAgICAgJ0Nyb3NzLU9yaWdpbi1FbWJlZGRlci1Qb2xpY3knOiAndW5zYWZlLW5vbmUnLFxyXG4gICAgICAvLyBIZWFkZXJzIGRlIHNlZ3VyaWRhZCBhZGljaW9uYWxlc1xyXG4gICAgICAnWC1GcmFtZS1PcHRpb25zJzogJ0RFTlknLFxyXG4gICAgICAnWC1Db250ZW50LVR5cGUtT3B0aW9ucyc6ICdub3NuaWZmJyxcclxuICAgICAgJ1JlZmVycmVyLVBvbGljeSc6ICdzdHJpY3Qtb3JpZ2luLXdoZW4tY3Jvc3Mtb3JpZ2luJyxcclxuICAgIH0sXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfQkFDS0VORF9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMycsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgICcvaGVhbHRoJzoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVklURV9CQUNLRU5EX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDozMDAzJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUlBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFNBQVMsV0FBVztBQUFBLEVBQ2hDO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZLENBQUMscUJBQXFCO0FBQUEsSUFDbEMsU0FBUyxDQUFDLGtEQUFrRDtBQUFBLElBQzVELFNBQVMsQ0FBQyxnQkFBZ0IsUUFBUSxTQUFTLFFBQVEsUUFBUTtBQUFBLElBQzNELE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxRQUNKLFFBQVEsQ0FBQyxtQkFBbUIsaUJBQWlCLFNBQVMsV0FBVztBQUFBLE1BQ25FO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxNQUNKLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFBQSxJQUMvQjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BR1AsOEJBQThCO0FBQUEsTUFDOUIsZ0NBQWdDO0FBQUEsTUFFaEMsbUJBQW1CO0FBQUEsTUFDbkIsMEJBQTBCO0FBQUEsTUFDMUIsbUJBQW1CO0FBQUEsSUFDckI7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVEsUUFBUSxJQUFJLG9CQUFvQjtBQUFBLFFBQ3hDLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDVCxRQUFRLFFBQVEsSUFBSSxvQkFBb0I7QUFBQSxRQUN4QyxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
