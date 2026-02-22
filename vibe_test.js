function excessiveParams(a, b, c, d, e, f) {
    console.log("Too many params");
}

function emptyCatch() {
    try {
        eval("console.log('vibe')");
    } catch (e) {
        // empty!
    }
}

document.body.innerHTML = "<h1>Slop</h1>";

const link = '<a href="https://example.com" target="_blank">Click me</a>';

function longFunction() {
    // Line 1
    // Line 2
    // ... imagine 55 lines ...
    console.log("test");
}
