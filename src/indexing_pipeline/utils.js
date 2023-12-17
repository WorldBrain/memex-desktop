const { JSDOM } = require('jsdom')
const TurndownService = require('turndown')
const stopwords = require('stopwords-iso') // object of stopwords for multiple languages
var posTagger = require('wink-pos-tagger')

exports.splitContentInReasonableChunks = async function (contentText) {
    var htmlDoc = new JSDOM(contentText)

    var paragraphs = htmlDoc.window.document.querySelectorAll('p')

    var chunks = []

    paragraphs.forEach(function (paragraph) {
        var chunk = paragraph.textContent

        var turndownService = new TurndownService()
        chunk = turndownService.turndown(chunk)

        if (chunk.length > 50) {
            chunks.push(chunk)
        }
    })

    return chunks
}
exports.cleanFullHTML = async function (fullHTML) {
    let cleanFullHTML = fullHTML

    const dom = new JSDOM(cleanFullHTML)
    const document = dom.window.document

    const scriptTags = document.getElementsByTagName('script')
    const styleTags = document.getElementsByTagName('style')
    const svgTags = document.getElementsByTagName('svg')

    for (let i = scriptTags.length - 1; i >= 0; i--) {
        scriptTags[i].parentNode.removeChild(scriptTags[i])
    }

    for (let i = styleTags.length - 1; i >= 0; i--) {
        styleTags[i].parentNode.removeChild(styleTags[i])
    }

    for (let i = svgTags.length - 1; i >= 0; i--) {
        svgTags[i].parentNode.removeChild(svgTags[i])
    }

    cleanFullHTML = dom.serialize()

    return cleanFullHTML
}

exports.prepareContentForEmbedding = async function (contentText) {
    let response

    // Remove all special characters
    contentText = contentText.replace(/[^\w\s]/gi, ' ')

    // Deduplicate words
    var words = contentText.split(' ')

    // Make all words lowercase
    words = words.map(function (word) {
        return word.toLowerCase().trim()
    })

    // Remove stop words
    var stopWords = [
        'a',
        'an',
        'the',
        'in',
        'is',
        'it',
        'you',
        'are',
        'for',
        'from',
        'as',
        'with',
        'their',
        'if',
        'on',
        'that',
        'at',
        'by',
        'this',
        'and',
        'to',
        'be',
        'which',
        'or',
        'was',
        'of',
        'and',
        'in',
        'is',
        'it',
        'that',
        'then',
        'there',
        'these',
        'they',
        'we',
        'were',
        'you',
        'your',
        'I',
        'me',
        'my',
        'the',
        'to',
        'and',
        'in',
        'is',
        'it',
        'of',
        'that',
        'you',
        'a',
        'an',
        'and',
        'are',
        'as',
        'at',
        'be',
        'by',
        'for',
        'from',
        'has',
        'he',
        'in',
        'is',
        'it',
        'its',
        'of',
        'on',
        'that',
        'the',
        'to',
        'was',
        'were',
        'will',
        'with',
    ]
    words = words.filter(function (word) {
        return !stopWords.some(function (stopWord) {
            return stopWord === word
        })
    })

    response = Array.from(new Set(words)).join(' ')

    return response
}

exports.extractEntitiesFromText = async function (
    text,
    entityExtractionFunction,
) {
    // Analyse with english language statistics
    var tagger = posTagger()
    const taggedText = tagger.tagSentence(text)

    const filteredTaggedText = taggedText.filter((item) => {
        // List of item descriptions
        // CC Coord Conjuncn           and,but,or
        // CD Cardinal number          one,two
        // DT Determiner               the,some
        // EX Existential there        there
        // FW Foreign Word             mon dieu
        // IN Preposition              of,in,by
        // JJ Adjective                big
        // JJR Adj., comparative       bigger
        // JJS Adj., superlative       biggest
        // LS List item marker         1,One
        // MD Modal                    can,should
        // NN Noun, sing. or mass      dog
        // NNP Proper noun, sing.      Edinburgh
        // NNPS Proper noun, plural    Smiths
        // NNS Noun, plural            dogs
        // POS Possessive ending       's
        // PDT Predeterminer           all, both
        // PRP$ Possessive pronoun     my,one's
        // PRP Personal pronoun        I,you,she
        // RB Adverb                   quickly
        // RBR Adverb, comparative     faster
        // RBS Adverb, superlative     fastest
        // RP Particle                 up,off
        // SYM Symbol                  +,%,&
        // TO 'to'                     to
        // UH Interjection             oh, oops
        // VB verb, base form          eat
        // VBD verb, past tense        ate
        // VBG verb, gerund            eating
        // VBN verb, past part         eaten
        // VBP Verb, present           eat
        // VBZ Verb, present           eats
        // WDT Wh-determiner           which,that
        // WP Wh pronoun               who,what
        // WP$ Possessive-Wh           whose
        // WRB Wh-adverb               how,where
        // , Comma                     ,
        // . Sent-final punct          . ! ?
        // : Mid-sent punct.           : ; Ñ
        // $ Dollar sign               $
        // # Pound sign                #
        // " quote                     "
        // ( Left paren                (
        // ) Right paren               )

        const unwantedPos = [
            'CC',
            'DT',
            'EX',
            'IN',
            'JJ',
            'JJR',
            'JJS',
            'LS',
            'MD',
            'POS',
            'PDT',
            'PRP$',
            'PRP',
            'RBS',
            'SYM',
            'TO',
            'UH',
            'WDT',
            'WP',
            'WP$',
            'WRB',
            ',',
            '.',
            '.',
            '-',
            '::',
            '#',
            '"',
            '(',
            ')',
            '-',
            '\\',
            '[',
            ']',
        ]
        return !unwantedPos.some((pos) => pos === item.pos)
    })

    // Add the "value" and the "lemma" to the "entities"
    let entities = []
    filteredTaggedText.forEach((item) => {
        entities.push(item.value)
        item.lemma &&
            item.value.toLowerCase() !== item.lemma &&
            entities.push(item.lemma)
    })

    // Analyse with multilingual entity extraction library
    // const rawEntities = await entityExtractionFunction(text);
    let concatenatedEntity = ''

    // for (let i = 0; i < rawEntities.length; i++) {
    //   if (
    //     i < rawEntities.length - 1 &&
    //     rawEntities[i].index + 1 === rawEntities[i + 1].index
    //   ) {
    //     concatenatedEntity += rawEntities[i].word + " ";
    //   } else {
    //     concatenatedEntity += rawEntities[i].word;
    //     entities.push(concatenatedEntity);
    //     concatenatedEntity = "";
    //   }
    // }

    // remove weird extractions that happen with unknown words that are split in the middle
    entities = entities.map((entity) => entity.replace(/ ##/g, ''))

    // remove stopwords
    const english = stopwords.en

    entities = entities.filter(
        (entity) => !english.includes(entity.toLowerCase()),
    )

    //// Analyse the text for any capitalised words and add them to entities
    // const words = text.split(" ");
    // let capitalizedEntity = "";
    // for (let i = 0; i < words.length; i++) {
    //   if (words[i][0] === words[i][0].toUpperCase()) {
    //     if (
    //       i < words.length - 1 &&
    //       words[i + 1][0] === words[i + 1][0].toUpperCase() &&
    //       !english.includes(words[i][0].toLowerCase())
    //     ) {
    //       capitalizedEntity += words[i] + " ";
    //     } else {
    //       capitalizedEntity += words[i];
    //       entities.push(capitalizedEntity);
    //       capitalizedEntity = "";
    //     }
    //   }
    // }

    // Remove all entities that are just these characters
    const unwantedChars = [
        ',',
        '.',
        '-',
        ':',
        '#',
        '"',
        '(',
        ')',
        '\\',
        '[',
        ']',
    ]
    entities = entities.filter((entity) => !unwantedChars.includes(entity))

    // Remove all numbers with less than 3 characters
    entities = entities.filter(
        (entity) => !(entity.length < 3 && /^\d+$/.test(entity)),
    )

    // Deduplicate entities
    entities = [...new Set(entities)]

    return entities
}
