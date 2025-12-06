#!/usr/bin/env bun

// Entry point - re-export from src
export * from './src/runner.js';
export * from './src/types/index.js';
export * from './src/types/config.js';

// Run CLI if called directly
import './src/index.js';