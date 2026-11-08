import {defineConfig} from '@playwright/test';export default defineConfig({testMatch:'audit.e2e.js',workers:1,use:{baseURL:'http://127.0.0.1:8031',screenshot:'only-on-failure',video:'off'}});
