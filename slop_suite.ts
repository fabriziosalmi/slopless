/**
 * SLOP SUITE - TypeScript
 * This file is designed to trigger numerous Slopless rules.
 */

let insecure = "secret_password_123"; // VBC-001, VBC-005
api_key = 'sk-1234567890'; // VBC-001 (Global leak)

function get_user_data_and_mutate_it(id: any) { // VBC-057 (any), VBC-058 (not camelCase? wait, checking naming rules)
    console.log("Fetching..."); // VBC-004
    const data = { id: id };
    // Lying function name: it's a 'get' but it mutates
    delete data.id; // VBC-??? (lying-function-names)
    return data;
}

// Boolean naming slop
const active = true; // VBC-501
const admin = false; // VBC-501

// Collection naming slop
const item = [1, 2, 3]; // VBC-503

// Function with too many parameters
function processEverything(a, b, c, d, e, f, g, h) { // VBC-028
    // Deep nesting (Hadouken)
    if (a) {
        if (b) {
            if (c) {
                if (d) {
                    if (e) {
                        console.log("Deep slop"); // VBC-004
                    }
                }
            }
        }
    }

    // Redundant boolean logic
    if (a == true) { // VBC-??? (redundant-if-true)
        return true;
    } else {
        return false;
    }
}

// Empty catch and blocks
try {
    eval("console.log('danger')"); // VBC-039
} catch (e) {
    // Empty catch
} // VBC-013

if (true) { } // VBC-??? (empty-block)

// Semantic shadowing
const fs = "just a string"; // VBC-504
const path = "/root"; // VBC-504

// Empty interface
interface Useless { } // VBC-909

// Shouting in comments
// FIXME: THIS IS BROKEN!!!! // VBC-906, VBC-917

// Jargon in Class Name
class DataManagerHelperBase { } // VBC-911, VBC-929 (Wait, jargon is for docs, but meaningless names for code)
