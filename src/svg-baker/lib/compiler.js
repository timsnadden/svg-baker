const Promise = require('bluebird');
const merge = require('merge-options');
const FileRequest = require('./request');
const RuleSet = require('./rules');
const Sprite = require('./sprite');
const SpriteSymbol = require('./symbol');
const symbolFactory = require('./symbol-factory');
const spriteFactory = require('./sprite-factory');

const defaultConfig = {
  rules: [
    { test: /\.svg$/, value: 'sprite.svg' }
  ],
  symbolFactory,
  spriteFactory
};

class Compiler {
  constructor(cfg = {}) {
    const config = this.config = merge(defaultConfig, cfg);
    this.rules = new RuleSet(config.rules);
    this.symbols = [];
  }

  /**
   * @param {string} content
   * @param {string} path
   * @param {string} [id]
   * @return {Promise<SpriteSymbol>}
   */
  addSymbol({ id, path, content }) {
    const symbols = this.symbols;
    const factory = this.config.symbolFactory;
    const request = new FileRequest(path);
    const options = { id, request, content, factory };

    const existing = symbols.find(s => s.request.equals(request));
    const existingIndex = existing ? symbols.indexOf(existing) : -1;
    const allExceptCurrent = symbols
      .filter(({ req }) => req.fileEquals(request) && !req.queryEquals(request))
      .map(symbol => ({ symbol, index: symbols.indexOf(symbol) }));

    return SpriteSymbol.create(options).then((newSymbol) => {
      if (!existing) {
        symbols.push(newSymbol);
        return newSymbol;
      }

      symbols[existingIndex] = newSymbol;

      return Promise.map(allExceptCurrent, ({ symbol, index }) => {
        const opts = { id: symbol.id, request: symbol.request, content, factory };

        // eslint-disable-next-line no-return-assign
        return SpriteSymbol.create(opts).then(created => symbols[index] = created);
      }).then(() => newSymbol);
    });
  }

  /**
   * @return {Promise<Array<Sprite>>}
   */
  compile() {
    const symbols = this.symbols;
    const rules = this.rules.rules;
    const factory = this.config.spriteFactory;

    return Promise.map(rules, (rule) => {
      const spriteSymbols = [];
      const filename = rule.value;

      symbols.forEach((symbol) => {
        const isMatch = rule.match(symbol.request.file);
        if (isMatch) {
          spriteSymbols.push(symbol);
        }
      });

      return spriteSymbols.length > 0 ?
        Sprite.create({ symbols: spriteSymbols, filename, factory }) :
        null;
    }).filter(result => result !== null);
  }
}

module.exports = Compiler;
module.exports.defaultConfig = defaultConfig;
