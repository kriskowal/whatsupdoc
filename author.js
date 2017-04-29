
exports.Author = function (author) {
    if (!(this instanceof exports.Author))
        return new exports.Author(author);
    if (typeof author == "string") {
        var match = author.match(exports.Author.regexp);
        this.name = match[1].trim();
        this.url = match[2];
        this.email = match[3];
    } else {
        this.name = author.name;
        this.url = author.url;
        this.email = author.email;
    }
};

exports.Author.prototype.toString = function () {
    return [
        this.name,
        this.url ? "(" + this.url + ")" : undefined,
        this.email ? "<" + this.email + ">" : undefined
    ].filter(part => !!part).join(' ');
};

exports.Author.regexp = new RegExp(
    "(?:" +
        "([^\\(<]*)" +
        " ?" + 
    ")?" +
    "(?:" +
        "\\(" +
            "([^\\)]*)" +
        "\\)" +
    ")?" +
    " ?" +
    "(?:<([^>]*)>)?"
);

