import { join, dirname } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import both versions
import escaladeOptimized from '../src/async.js';
import escaladeSyncOptimized from '../src/sync.js';

// Create deep directory structure for testing
function createDeepStructure(basePath, depth) {
	if (existsSync(basePath)) {
		rmSync(basePath, { recursive: true, force: true });
	}

	let currentPath = basePath;
	for (let i = 0; i < depth; i++) {
		currentPath = join(currentPath, `level${i}`);
		mkdirSync(currentPath, { recursive: true });

		// Add some files at each level
		writeFileSync(join(currentPath, `file${i}.txt`), `content at level ${i}`);
	}

	// Add target file at a specific depth
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
	console.log(`  Total: ${totalTime.toFixed(2)}ms`);
	console.log(`  Average: ${avgTime.toFixed(4)}ms`);
	console.log(`  Ops/sec: ${opsPerSec.toFixed(0)}`);
	console.log('');

	return { totalTime, avgTime, opsPerSec };
}

// Main benchmark suite
async function runBenchmarks() {
	console.log('Creating test directory structure...\n');

	const testDir = join(__dirname, 'test-structure');
	const deepPath = createDeepStructure(testDir, 15);

	console.log('=== ESCALADE OPTIMIZATION BENCHMARKS ===\n');

	// Test 1: Find file at shallow depth (package.json at level 1)
	console.log('Test 1: Shallow search (2 levels) - package.json');
	console.log('---');

	const asyncShallow = await benchmark('Async (Optimized)', async () => {
		return await escaladeOptimized(join(testDir, 'level0'), (dir, names) => {
			return names.includes('package.json') && 'package.json';
		});
	}, 5000);

	const syncShallow = await benchmark('Sync (Optimized)', async () => {
		return escaladeSyncOptimized(join(testDir, 'level0'), (dir, names) => {
			return names.includes('package.json') && 'package.json';
		});
	}, 5000);

	// Test 2: Find file at medium depth (target.json at level 3)
	console.log('Test 2: Medium search (4 levels) - target.json');
	console.log('---');

	const asyncMedium = await benchmark('Async (Optimized)', async () => {
		return await escaladeOptimized(deepPath, (dir, names) => {
			return names.includes('target.json') && 'target.json';
		});
	}, 2000);

	const syncMedium = await benchmark('Sync (Optimized)', async () => {
		return escaladeSyncOptimized(deepPath, (dir, names) => {
			return names.includes('target.json') && 'target.json';
		});
	}, 2000);

	// Test 3: Search for non-existent file (full traversal)
	console.log('Test 3: Deep search (15+ levels) - missing.txt (not found)');
	console.log('---');

	const asyncDeep = await benchmark('Async (Optimized)', async () => {
		return await escaladeOptimized(deepPath, (dir, names) => {
			return names.includes('missing.txt') && 'missing.txt';
		});
	}, 1000);

	const syncDeep = await benchmark('Sync (Optimized)', async () => {
		return escaladeSyncOptimized(deepPath, (dir, names) => {
			return names.includes('missing.txt') && 'missing.txt';
		});
	}, 1000);

	// Test 4: Repeated lookups (cache performance test)
	console.log('Test 4: Repeated lookups (cache test) - same query 10 times');
	console.log('---');

	const asyncCached = await benchmark('Async (Optimized - cached)', async () => {
		for (let i = 0; i < 10; i++) {
			await escaladeOptimized(join(testDir, 'level0'), (dir, names) => {
				return names.includes('package.json') && 'package.json';
			});
		}
	}, 500);

	const syncCached = await benchmark('Sync (Optimized - cached)', async () => {
		for (let i = 0; i < 10; i++) {
			escaladeSyncOptimized(join(testDir, 'level0'), (dir, names) => {
				return names.includes('package.json') && 'package.json';
			});
		}
	}, 500);

	// Summary
	console.log('=== SUMMARY ===');
	console.log('\nAsync Performance:');
	console.log(`  Shallow: ${asyncShallow.opsPerSec.toFixed(0)} ops/sec`);
	console.log(`  Medium: ${asyncMedium.opsPerSec.toFixed(0)} ops/sec`);
	console.log(`  Deep: ${asyncDeep.opsPerSec.toFixed(0)} ops/sec`);
	console.log(`  Cached: ${asyncCached.opsPerSec.toFixed(0)} ops/sec`);

	console.log('\nSync Performance:');
	console.log(`  Shallow: ${syncShallow.opsPerSec.toFixed(0)} ops/sec`);
	console.log(`  Medium: ${syncMedium.opsPerSec.toFixed(0)} ops/sec`);
	console.log(`  Deep: ${syncDeep.opsPerSec.toFixed(0)} ops/sec`);
	console.log(`  Cached: ${syncCached.opsPerSec.toFixed(0)} ops/sec`);

	// Cleanup
	console.log('\nCleaning up test directory...');
	rmSync(testDir, { recursive: true, force: true });
	console.log('Done!');
}

// Run benchmarks
runBenchmarks().catch(console.error);
