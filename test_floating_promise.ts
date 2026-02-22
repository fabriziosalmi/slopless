// Test file for floating promise semantic check

async function doSomethingSlow() {
    return new Promise(resolve => setTimeout(resolve, 100));
}

function maliciousCaller() {
    // This is a floating promise (not awaited)
    doSomethingSlow();

    // This one is fine
    const p = doSomethingSlow();

    // This is also fine
    return doSomethingSlow();
}
