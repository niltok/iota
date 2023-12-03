// @ts-check
const marked = require('marked')
const katex = require('katex')
const fs = require('fs')
const hljs = require('highlight.js').default
const subsetFont = require('subset-font')

require("./marked-katex")(marked, katex)

hljs.registerLanguage('idris', function(hljs) {
    return {
        keywords: ['record', 'constructor', 'where', 'case', 'of', 'data', 'codata'],
        contains: []
    }
})

hljs.registerLanguage('51asm', function(hljs) {
    return {
        case_insensitive: true,
        contains: [
            hljs.COMMENT(';', '\n'),
            {
                scope: 'built_in',
                match: /\b(a|b|c|ab|dptr|r[0-7]|p[0-7](\.[0-7])?|acc(.[0-7])?|scon|sbuf)\b/
            },
            {
                scope: 'keyword',
                match: /^\s*[a-z]+\s/
            },
            {
                scope: 'title',
                match: /((\b)(([0-1]+b)|([0-9][0-9a-f]*h)|[0-9]+))/
            },
            {
                scope: 'string',
                match: /(((#)(([0-1]+b)|([0-9][0-9a-f]*h)|[0-9]+)\b)|(@|\+|:))/ // (r[0-7]|dptr(\s*\+\s*a)?|pc\s*\+\s*a|a\s*\+\s*(dptr|pc))
            }
        ]
    }
})

const $$ = (/** @type {string} */ label, attr = '') => (/** @type {string} */ s) => '<' + label + ' ' + attr + '>\n' + s + '</' + label + '>\n'

/**
 * @typedef {{
 *   title: string
 * }} Config
 * 
 * @typedef {Record<string, Config>} Configs
*/

/** @type {Configs} */
const config = JSON.parse(fs.readFileSync('config.json').toString())
// const style = $$('style')(fs.readFileSync('style.css'))

console.log('clean...')

if (fs.existsSync("docs")) fs.readdirSync("docs").forEach(f => {
    if (f.endsWith('.html') || f.endsWith('.woff2')) fs.rmSync('docs/' + f)
})
else fs.mkdirSync("docs")

const charset = '<meta charset="utf-8"/>\n'
const compat = '<meta http-equiv="x-ua-compatible" content="ie=edge">\n'
const viewpoint = '<meta name="viewport" content="width=device-width,initial-scale=1.0">\n'
const icon = '<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">\n'
const title = (/** @type {Config | undefined} */ conf, /** @type {string} */ s) => {
    let title = conf?.title
    if (!title) {
        title = s.split('\n')[0]?.substring(2)
    }
    return $$('title')(title ?? '')
}

const hljscss = '<link href="https://cdn.bootcdn.net/ajax/libs/highlight.js/10.3.2/styles/a11y-light.min.css" rel="stylesheet">'
const materialize = '<link href="https://cdn.bootcdn.net/ajax/libs/materialize/1.0.0-rc.2/css/materialize.min.css" rel="stylesheet">'
const katexcss = '<link href="https://cdn.bootcdn.net/ajax/libs/KaTeX/0.13.13/katex.min.css" rel="stylesheet">'
const style = '<link href="style.css" rel="stylesheet">'

const head = (/** @type {Config | undefined} */ conf, /** @type {string} */ s) => 
    $$('head')(charset + compat + viewpoint + icon + title(conf, s) + katexcss + style)

const github = '<a href="https://github.com/niltok">🔥GitHub🔥</a>'
const home = '<a href="index.html">🏠Homepage🏠</a>'

let fullText = github + home
let codeText = ''

const gen = (/** @type {Config | undefined} */ conf, /** @type {string} */ s) => {
    return '<!DOCTYPE html>' + $$('html', 'lang="zh-CN" prefix="og: https://ogp.me/ns#"')
    (head(conf, s) + $$('body')($$('p')(home + ' | ' + github) +
        marked.marked(s, {
            highlight: (/** @type {string} */ code, /** @type {string} */ lang) => {
                codeText += code
                if (typeof lang == 'undefined' || lang == '')
                    return hljs.highlightAuto(code).value
                else if (lang == 'nohighlight')
                    return code
                else return hljs.highlight(code, { language: lang }).value
            }
        })))
}

console.log('convert markdown...')

fs.readdirSync("src").forEach(f => {
    if (f.endsWith(".md")) {
        const content = fs.readFileSync("src/" + f).toString()
        fullText += content
        fs.writeFileSync("docs/" + f.slice(0, f.length - 3) + ".html", gen(config[f], content))
    }
})

console.log('convert font...')

subsetFont(fs.readFileSync('body.woff2'), fullText, { targetFormat: 'woff2' }).then(f => {
    fs.writeFileSync('docs/body.woff2', f)
    return subsetFont(fs.readFileSync('code.ttf'), codeText, { targetFormat: 'woff2' })
}).then(f => {
    fs.writeFileSync('docs/code.woff2', f)
    return subsetFont(fs.readFileSync('emoji.ttf'), fullText, { targetFormat: 'woff2' })
}).then(f => {
    fs.writeFileSync('docs/emoji.woff2', f)
    console.log('done')
})
