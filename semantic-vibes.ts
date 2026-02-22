function processUser(user: any) {
    // 1. Boolean naming slop
    const active = true;
    const admin: boolean = false;

    // 2. Collection naming slop
    const item = [1, 2, 3];
    const user_list = ['alice', 'bob']; // This one ends with 'list', should be ok

    // 3. Boolean redundancy slop
    if (active) {
        return true;
    } else {
        return false;
    }

    if (item.length > 0) {
        return false;
    } else {
        return true;
    }
}
