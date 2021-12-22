module.exports = function(marked, katex) {
    const renderer = new marked.Renderer()
    let originParagraph = renderer.paragraph.bind(renderer)
    renderer.paragraph = (text) => {
        const blockRegex = /\$\$[^\$]*\$\$/g
        const inlineRegex = /\$[^\$]*\$/g
        let blockExprArray = text.match(blockRegex)
        let inlineExprArray = text.match(inlineRegex)
        for (let i in blockExprArray) {
            const expr = blockExprArray[i]
            const result = katex.renderToString(expr.substr(2, expr.length - 4), {
                throwOnError: false,
                displayMode: true
            })
            text = text.replace(expr, result)
        }
        for (let i in inlineExprArray) {
            const expr = inlineExprArray[i]
            const result = katex.renderToString(expr.substr(1, expr.length - 2), {
                throwOnError: false,
                displayMode: false
            })
            text = text.replace(expr, result)
        }
        return originParagraph(text)
    }
    marked.setOptions({ renderer: renderer })
};