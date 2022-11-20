const marked = require('marked')
const katex = require('katex')
const fs = require('fs')
const hljs = require('highlight.js')

require("./marked-katex")(marked, katex)

hljs.registerLanguage('idris', function(hljs) {
    return {
        keywords: ['record', 'constructor', 'where', 'case', 'of', 'data', 'codata'],
        contains: []
    }
})

const $$ = label => s => '<' + label + '>\n' + s + '</' + label + '>\n'

const config = JSON.parse(fs.readFileSync('config.json').toString())
const style = $$('style')(fs.readFileSync('style.css'))

if (fs.existsSync("docs")) fs.readdirSync("docs").forEach(f => {
    if (f.endsWith('.html')) fs.rmSync('docs/' + f)
})
else fs.mkdirSync("docs")

const charset = '<meta charset="utf-8"/>\n'
const viewpoint = '<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=0">\n'
const icon = '<link rel="shortcut icon" href="favicon.ico" type="image/x-icon">\n'
const title = conf => $$('title')(conf.title)

const hljscss = '<link href="https://cdn.bootcdn.net/ajax/libs/highlight.js/10.3.2/styles/a11y-light.min.css" rel="stylesheet">'
const materialize = '<link href="https://cdn.bootcdn.net/ajax/libs/materialize/1.0.0-rc.2/css/materialize.min.css" rel="stylesheet">'
const katexcss = '<link href="https://cdn.bootcdn.net/ajax/libs/KaTeX/0.13.13/katex.min.css" rel="stylesheet">'

const head = conf => $$('head')(charset + viewpoint + icon + title(conf) + katexcss + style)

const github = '<a href="https://github.com/niltok">🔥GitHub🔥</a>'
const home = '<a href="https://iota.huohuo.moe">🏠Homepage🏠</a>'

const gen = conf => s => {
    return $$('html')(head(conf) + $$('body')($$('p')(home + ' | ' + github) +
        marked.marked(s, {
            highlight: (code, lang) => {
                if (typeof lang == 'undefined' || lang == '')
                    return hljs.highlightAuto(code).value
                else if (lang == 'nohighlight')
                    return code
                else return hljs.highlight(code, { language: lang }).value
            }
        })))
}

fs.readdirSync("src").forEach(f => {
    if (f.endsWith(".md")) {
        const content = fs.readFileSync("src/" + f).toString()
        fs.writeFileSync("docs/" + f.slice(0, f.length - 3) + ".html", gen(config[f])(content))
    }
})