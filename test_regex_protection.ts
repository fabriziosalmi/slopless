// This is a test file for the Slopless AST protected ranges feature.

const safeString = "This is a string containing a forbidden word like 'var'";

/*
  Look at this multiline comment containing the word var
  This should be completely ignored by Slopless.
*/

var thisShouldFail = true;
