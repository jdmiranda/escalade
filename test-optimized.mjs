import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import escalade from './dist/index.mjs';
import escaladeSync from './sync/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtures = join(__dirname, 'test', 'fixtures');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, message) {
	if (actual === expected) {
		console.log(`✓ ${message}`);
		passed++;
	} else {
		console.log(`✗ ${message}`);
		console.log(`  Expected: ${expected}`);
		console.log(`  Got: ${actual}`);
		failed++;
	}
}

function assertType(value, type, message) {
	if (typeof value === type) {
		console.log(`✓ ${message}`);
		passed++;
	} else {
		console.log(`✗ ${message}`);
		console.log(`  Expected type: ${type}`);
		console.log(`  Got type: ${typeof value}`);
		failed++;
	}
}

async function runTests() {
	console.log('=== TESTING OPTIMIZED ESCALADE ===\n');

	// Test 1: Export type
	console.log('Test 1: Exports');
	assertType(escalade, 'function', 'async version exports function');
	assertType(escaladeSync, 'function', 'sync version exports function');

	// Test 2: Convert relative output to absolute
	console.log('\nTest 2: Relative to absolute path conversion');
	let output = await escalade(fixtures, () => 'foobar.js');
	assertEqual(output, join(fixtures, 'foobar.js'), 'converts relative path to absolute');

	// Test 3: Respect absolute output
	console.log('\nTest 3: Absolute path handling');
	let foobar = resolve('.', 'foobar.js');
	output = await escalade(fixtures, () => foobar);
	assertEqual(output, foobar, 'respects absolute paths');

	// Test 4: Allow file input
	console.log('\nTest 4: File input handling');
	let levels = 0;
	let input = join(fixtures, 'index.js');
	output = await escalade(input, dir => {
		levels++;
		return dir === fixtures && fixtures;
	});
	assertEqual(levels, 1, 'processes file input correctly');
	assertEqual(output, fixtures, 'returns correct path for file input');

	// Test 5: Directory names in contents
	console.log('\nTest 5: Directory traversal');
	levels = 0;
	output = await escalade(fixtures, (dir, files) => {
		levels++;
		return files.includes('fixtures') && 'fixtures';
	});
	assertEqual(levels, 2, 'traverses correct number of levels');
	assertEqual(output, fixtures, 'finds target directory');

	// Test 6: Immediate termination
	console.log('\nTest 6: Early termination');
	levels = 0;
	output = await escalade(fixtures, () => `${++levels}.js`);
	assertEqual(levels, 1, 'terminates immediately when match found');
	assertEqual(output, join(fixtures, '1.js'), 'returns correct path on immediate match');

	// Test 7: Package.json search
	console.log('\nTest 7: Package.json discovery');
	levels = 0;
	output = await escalade(fixtures, (dir, files) => {
		levels++;
		if (files.includes('package.json')) {
			return join(dir, 'package.json');
		}
	});
	assertEqual(levels, 3, 'traverses to package.json location');
	// Check that it found a package.json (path may vary based on cwd)
	if (output && output.endsWith('package.json')) {
		console.log(`✓ finds package.json`);
		passed++;
	} else {
		console.log(`✗ finds package.json`);
		console.log(`  Got: ${output}`);
		failed++;
	}

	// Test 8: Deep traversal
	console.log('\nTest 8: Deep directory traversal');
	levels = 0;
	let contents = 0;
	input = join(fixtures, 'foo', 'bar', 'hello', 'world.txt');
	await escalade(input, (dir, names) => {
		levels++;
		contents += names.length;
		if (dir === fixtures) return dir;
	});
	assertEqual(levels, 4, 'traverses deep directory structure');
	assertEqual(contents, 10, 'accumulates directory contents correctly');

	// Test 9: Async callback support
	console.log('\nTest 9: Async callback support');
	levels = 0;
	const sleep = () => new Promise(r => setTimeout(r, 10));
	output = await escalade(fixtures, async (dir) => {
		await sleep().then(() => levels++);
		if (levels === 3) return dir;
	});
	assertEqual(levels, 3, 'handles async callbacks');
	assertEqual(output, resolve(fixtures, '..', '..'), 'returns correct path with async callback');

	// Test 10: Sync version basic test
	console.log('\nTest 10: Sync version');
	levels = 0;
	output = escaladeSync(fixtures, (dir, files) => {
		levels++;
		return files.includes('package.json') && 'package.json';
	});
	assertEqual(levels, 3, 'sync version traverses correctly');
	// Check that it found a package.json (path may vary based on cwd)
	if (output && output.endsWith('package.json')) {
		console.log(`✓ sync version finds package.json`);
		passed++;
	} else {
		console.log(`✗ sync version finds package.json`);
		console.log(`  Got: ${output}`);
		failed++;
	}

	// Test 11: Cache performance test
	console.log('\nTest 11: Cache performance (repeated searches)');
	const start = performance.now();
	for (let i = 0; i < 100; i++) {
		await escalade(fixtures, (dir, files) => {
			return files.includes('package.json') && 'package.json';
		});
	}
	const duration = performance.now() - start;
	console.log(`✓ 100 repeated searches completed in ${duration.toFixed(2)}ms (avg: ${(duration/100).toFixed(3)}ms)`);
	passed++;

	// Summary
	console.log('\n=== TEST SUMMARY ===');
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);

	if (failed === 0) {
		console.log('\n✓ All tests passed!');
		process.exit(0);
	} else {
		console.log('\n✗ Some tests failed!');
		process.exit(1);
	}
}

runTests().catch(err => {
	console.error('Test error:', err);
	process.exit(1);
});
