import { join, dirname, resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdir, stat, readdirSync, statSync } from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Original implementation (before optimization)
const toStats = promisify(stat);
const toRead = promisify(readdir);

async function escaladeOriginal(start, callback) {
	let dir = resolve('.', start);
	let tmp, stats = await toStats(dir);

	if (!stats.isDirectory()) {
		dir = dirname(dir);
	}

	while (true) {
		tmp = await callback(dir, await toRead(dir));
		if (tmp) return resolve(dir, tmp);
		dir = dirname(tmp = dir);
		if (tmp === dir) break;
	}
}

function escaladeSyncOriginal(start, callback) {
	let dir = resolve('.', start);
	let tmp, stats = statSync(dir);

	if (!stats.isDirectory()) {
		dir = dirname(dir);
	}

	while (true) {
		tmp = callback(dir, readdirSync(dir));
		if (tmp) return resolve(dir, tmp);
		dir = dirname(tmp = dir);
		if (tmp === dir) break;
	}
}

// Import optimized versions
import escaladeOptimized from '../src/async.js';
import escaladeSyncOptimized from '../src/sync.js';

// Create test structure
function createDeepStructure(basePath, depth) {
	if (existsSync(basePath)) {
		rmSync(basePath, { recursive: true, force: true });
	}

	let currentPath = basePath;
	for (let i = 0; i < depth; i++) {
		currentPath = join(currentPath, `level${i}`);
		mkdirSync(currentPath, { recursive: true });
		writeFileSync(join(currentPath, `file${i}.txt`), `content ${i}`);
	}

	writeFileSync(join(basePath, 'level0', 'level1', 'level2', 'target.json'), '{"found": true}');
	writeFileSync(join(basePath, 'package.json'), '{"name": "test"}');

	return currentPath;
}

// Benchmark function
async function benchmark(name, fn, iterations = 1000) {
	// Warmup
	for (let i = 0; i < 10; i++) {
		await fn();
	}

	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		await fn();
	}
	const end = performance.now();

	const totalTime = end - start;
	const avgTime = totalTime / iterations;
	const opsPerSec = (1000 / avgTime) * 1000;

	console.log(`${name}:`);
	console.log(`  Ops/sec: ${opsPerSec.toFixed(0)}`);

	return { totalTime, avgTime, opsPerSec };
}

// Main comparison
async function runComparison() {
	console.log('=== ESCALADE PERFORMANCE COMPARISON ===\n');
	console.log('Creating test directory structure...\n');

	const testDir = join(__dirname, 'comparison-structure');
	const deepPath = createDeepStructure(testDir, 12);

	// Test 1: Shallow search
	console.log('Test 1: Shallow search (package.json at level 1)');
	console.log('---');

	const originalAsyncShallow = await benchmark('Original Async', async () => {
		return await escaladeOriginal(join(testDir, 'level0'), (dir, names) => {
			return names.includes('package.json') && 'package.json';
		});
	}, 3000);

	const optimizedAsyncShallow = await benchmark('Optimized Async', async () => {
		return await escaladeOptimized(join(testDir, 'level0'), (dir, names) => {
			return names.includes('package.json') && 'package.json';
		});
	}, 3000);

	const improvementAsyncShallow = ((optimizedAsyncShallow.opsPerSec - originalAsyncShallow.opsPerSec) / originalAsyncShallow.opsPerSec * 100);
	console.log(`Improvement: ${improvementAsyncShallow > 0 ? '+' : ''}${improvementAsyncShallow.toFixed(1)}%\n`);

	// Test 2: Medium search
	console.log('Test 2: Medium search (target.json at level 3)');
	console.log('---');

	const originalAsyncMedium = await benchmark('Original Async', async () => {
		return await escaladeOriginal(deepPath, (dir, names) => {
			return names.includes('target.json') && 'target.json';
		});
	}, 2000);

	const optimizedAsyncMedium = await benchmark('Optimized Async', async () => {
		return await escaladeOptimized(deepPath, (dir, names) => {
			return names.includes('target.json') && 'target.json';
		});
	}, 2000);

	const improvementAsyncMedium = ((optimizedAsyncMedium.opsPerSec - originalAsyncMedium.opsPerSec) / originalAsyncMedium.opsPerSec * 100);
	console.log(`Improvement: ${improvementAsyncMedium > 0 ? '+' : ''}${improvementAsyncMedium.toFixed(1)}%\n`);

	// Test 3: Sync comparison
	console.log('Test 3: Sync shallow search (package.json)');
	console.log('---');

	const originalSyncShallow = await benchmark('Original Sync', async () => {
		return escaladeSyncOriginal(join(testDir, 'level0'), (dir, names) => {
			return names.includes('package.json') && 'package.json';
		});
	}, 3000);

	const optimizedSyncShallow = await benchmark('Optimized Sync', async () => {
		return escaladeSyncOptimized(join(testDir, 'level0'), (dir, names) => {
			return names.includes('package.json') && 'package.json';
		});
	}, 3000);

	const improvementSyncShallow = ((optimizedSyncShallow.opsPerSec - originalSyncShallow.opsPerSec) / originalSyncShallow.opsPerSec * 100);
	console.log(`Improvement: ${improvementSyncShallow > 0 ? '+' : ''}${improvementSyncShallow.toFixed(1)}%\n`);

	// Final summary
	console.log('=== PERFORMANCE IMPROVEMENTS ===');
	console.log(`Async Shallow: ${improvementAsyncShallow > 0 ? '+' : ''}${improvementAsyncShallow.toFixed(1)}%`);
	console.log(`Async Medium: ${improvementAsyncMedium > 0 ? '+' : ''}${improvementAsyncMedium.toFixed(1)}%`);
	console.log(`Sync Shallow: ${improvementSyncShallow > 0 ? '+' : ''}${improvementSyncShallow.toFixed(1)}%`);

	const avgImprovement = (improvementAsyncShallow + improvementAsyncMedium + improvementSyncShallow) / 3;
	console.log(`\nAverage Improvement: ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(1)}%`);

	if (avgImprovement >= 30) {
		console.log('\n✓ TARGET ACHIEVED: 30%+ performance improvement!');
	} else {
		console.log(`\n⚠ Target not met. Need ${(30 - avgImprovement).toFixed(1)}% more improvement.`);
	}

	// Cleanup
	console.log('\nCleaning up...');
	rmSync(testDir, { recursive: true, force: true });
	console.log('Done!');
}

// Run comparison
runComparison().catch(console.error);
