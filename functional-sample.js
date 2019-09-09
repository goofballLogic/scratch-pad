/* A simple function verifyPassword which simply iterates through supplied rules and executes them against input,
returning a list of reasons for any rules which have failed */

function verifyPassword(rules, input) {

    return rules
        .map(rule => rule(input))
        .filter(result => !result.passed)
        .map(failed => failed.reason);

}

/* We can create a rule using this "verify" function: */

const verify = (criteria, reason) => input => criteria(input) ? { passed: true } : { passed: false, reason };

const exampleRule = verify(input => input.length > 0, "You must enter a password!");
verifyPassword([exampleRule], "P@ssw0rd"); // => []
verifyPassword([exampleRule], ""); //=> ["You must enter a password!"];

/* Now lets say that we want to use a stateful object which allows us to initialize the function with a set of
rules which can be executed many times over. One "javascript-native" way to do this might be as shown below. (I'm
setting aside ES6 classes for the moment) */

function buildPasswordVerifier(rules) {
    return function verifyPassword(input) {
        return rules
            .map(rule => rule(input))
            .filter(result => !result.passed)
            .map(failed => failed.reason);
    };
}

/* This allows us to "inject" the rules we want into our verification function, like so:*/

const rules = [
    verify(input => input && input.length > 6, "Minimum length is six characters"),
    verify(input => input.toLowerCase() !== input, "Must contain an uppercase character")
];
const verifyPassword = buildPasswordVerifier(rules);
verifyPassword("")          // => ["Minimum length is six characters","Must contain an uppercase character"];
verifyPassword("Abcdef")    // => []


/* However, our verifyPassword function is a bit verbose for my liking, so we can make it a bit more compact using
ES6 arrow functions (in fact below we arguably take things too far, and will need to back-track later!) */

const buildPasswordVerifier =
    rules =>
        input =>
            rules.map(rule => rule(input)).filter(result => !result.passed).map(failed => failed.reason);

/* Ok, so what could go wrong with this function? Well... lots of things. For example, what if we supplied an
array of rules which mistakenly contained a string instead of a function? (if we're not using typescript!) */

const verifyPassword = buildPasswordVerifier(["Must contain an uppercase character"]);
verifyPassword("Abcdef")    // => Error: Uncaught TypeError: rule is not a function

/* But it would have been nice for us to know this when we created the verifyPassword function, rather than
when we tried to use it. That way our program would be more likely to error out on startup, instead of when
the user has already invested time in using it! Lets write a test to ensure this behaviour. */

describe("Given a rule which isn't a function", () => {
    it("Should throw an error when I try to construct the function", () => {
        assert.throws(() => buildPasswordVerifier(["Must contain an uppercase character"]));
    });
});

/* This fails because the expected error is not thrown. We can fix it by adding a verification step in our
function as shown below: */

function validateRules(rules) {
    if (rules.some(rule => typeof rule !== "function")) throw new Error("Rules must be a function");
}

const buildPasswordVerifier =
    rules => {
        validateRules(rules);
        return input =>
            rules.map(rule => rule(input)).filter(result => !result.passed).map(failed => failed.reason);
    };

/* Great, this passes. However, at this point I'd rewrite the function to get rid of the arrow function again,
like this: */
function buildPasswordVerifier(rules) {
    validateRules(rules);
    return input => rules
        .map(rule => rule(input))
        .filter(result => !result.passed)
        .map(failed => failed.reason);
}

/* What else can go wrong - well a rule itself could throw an error if it's poorly written. Did you notice one in
the "Must contain an uppercase character" rule implemented above? */

const rules = [
    verify(input => input.toLowerCase() !== input, "Must contain an uppercase character")
];
const passowrdVerifier = buildPasswordVerifier(rules);
passowrdVerifier(null); // => Error: Uncaught TypeError: Cannot read property 'toLowerCase' of null

/* Our "uppercase" rule didn't validate it's input so it threw an error revealing internal details of how it is
implemented. One could argue that it would be best to let our error "bubble up the stack". However, we could also
choose to log our internal error, and simply return a generic failure for this password instead, which I will demonstrate
below.*/

function errorSafe(func, mapper) {
    try {
        func();
    } catch (err) {
        return mapper(err);
    }
}

function buidPasswordVerifier(rules) {
    validateRules(rules);
    return function (input) {
        const strategy = rules
            .map(rule => rule(input))
            .filter(result => !result.passed)
            .map(failed => failed.reason);
        return errorSafe(strategy, ["Verification failed"]);
    };
}

/* Let's test it */
describe("Given a rule which can throw an error", () => {
    let rules;
    beforeEach(() => {
        rules = [verify(input => input.toLowerCase() !== input, "Must contain an uppercase character")];
    });
    describe("When I try to verify a password which causes the error", () => {
        let action;
        beforeEach(() => {
            const passwordVerifier = buildPasswordVerifier(rules);
            action = () => passwordVerifier(null);
        })
        it("Should not throw an error", () => expect(action).not.toThrow());
        it("Should return a 'fail' reason", () => expect(action()[0]).toContain("fail"));
    })
});
