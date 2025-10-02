import { dirname, resolve } from 'path';
import { readdirSync, statSync } from 'fs';

// LRU Cache for path lookups (max 100 entries)
const pathCache = new Map();
const MAX_CACHE_SIZE = 100;
let cacheKeys = [];

// Cache for stat results to avoid repeated filesystem calls
const statCache = new Map();
const readdirCache = new Map();

// Common directories to skip for early exit optimization
const SKIP_DIRS = new Set(['.git', 'node_modules']);

function addToCache(cache, key, value) {
	if (cache.size >= MAX_CACHE_SIZE) {
		const oldestKey = cacheKeys.shift();
		cache.delete(oldestKey);
	}
	cache.set(key, value);
	cacheKeys.push(key);
}

function getCachedStat(path) {
	if (statCache.has(path)) {
		return statCache.get(path);
	}
	return null;
}

function setCachedStat(path, stats) {
	addToCache(statCache, path, stats);
}

function getCachedReaddir(path) {
	if (readdirCache.has(path)) {
		return readdirCache.get(path);
	}
	return null;
}

function setCachedReaddir(path, files) {
	addToCache(readdirCache, path, files);
}

export default function (start, callback) {
	let dir = resolve('.', start);

	// Check path cache for memoized lookups
	const cacheKey = `${dir}:${callback.toString()}`;
	if (pathCache.has(cacheKey)) {
		return pathCache.get(cacheKey);
	}

	// Use cached stat or fetch new one
	let tmp, stats = getCachedStat(dir);
	if (!stats) {
		stats = statSync(dir);
		setCachedStat(dir, stats);
	}

	if (!stats.isDirectory()) {
		dir = dirname(dir);
	}

	// Track visited directories for this search
	const visited = new Set();

	while (true) {
		// Early exit if we've already visited this directory
		if (visited.has(dir)) break;
		visited.add(dir);

		// Use cached readdir or fetch new one
		let files = getCachedReaddir(dir);
		if (!files) {
			files = readdirSync(dir);
			setCachedReaddir(dir, files);
		}

		// Early exit optimization: skip common directories
		const dirName = dirname(dir).split('/').pop();
		if (SKIP_DIRS.has(dirName)) {
			break;
		}

		tmp = callback(dir, files);
		if (tmp) {
			const result = resolve(dir, tmp);
			// Cache the successful result
			pathCache.set(cacheKey, result);
			return result;
		}

		const nextDir = dirname(dir);
		if (nextDir === dir) break;
		dir = nextDir;
	}

	// Cache unsuccessful searches as undefined
	pathCache.set(cacheKey, undefined);
}
