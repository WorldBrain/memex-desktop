const { JSDOM } = require("jsdom");
const TurndownService = require("turndown");

exports.splitContentInReasonableChunks = async function(contentText) {
  var htmlDoc = new JSDOM(contentText);

  var paragraphs = htmlDoc.window.document.querySelectorAll("p");

  var chunks = [];

  paragraphs.forEach(function(paragraph) {
    var chunk = paragraph.textContent;

    var turndownService = new TurndownService();
    chunk = turndownService.turndown(chunk);

    chunks.push(chunk);
  });

  return chunks;
};

exports.prepareContentForEmbedding = async function(contentText) {
  let response;

  // Remove all special characters
  contentText = contentText.replace(/[^\w\s]/gi, " ");

  // Deduplicate words
  var words = contentText.split(" ");

  // Make all words lowercase
  words = words.map(function(word) {
    return word.toLowerCase().trim();
  });

  // Remove stop words
  var stopWords = [
    "a",
    "an",
    "the",
    "in",
    "is",
    "it",
    "you",
    "are",
    "for",
    "from",
    "as",
    "with",
    "their",
    "if",
    "on",
    "that",
    "at",
    "by",
    "this",
    "and",
    "to",
    "be",
    "which",
    "or",
    "was",
    "of",
    "and",
    "in",
    "is",
    "it",
    "that",
    "then",
    "there",
    "these",
    "they",
    "we",
    "were",
    "you",
    "your",
    "I",
    "me",
    "my",
    "the",
    "to",
    "and",
    "in",
    "is",
    "it",
    "of",
    "that",
    "you",
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
  ];
  words = words.filter(function(word) {
    return !stopWords.some(function(stopWord) {
      return stopWord === word;
    });
  });

  response = Array.from(new Set(words)).join(" ");

  return response;
};