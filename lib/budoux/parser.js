/**
 * @license
 * Copyright 2021 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Base BudouX parser.
 */
export class Parser {
    /**
     * Constructs a BudouX parser.
     * @param model A model data.
     */
    constructor(model) {
        this.model = new Map(Object.entries(model).map(([k, v]) => [k, new Map(Object.entries(v))]));
        this.baseScore =
            -0.5 *
                [...this.model.values()]
                    .map(group => [...group.values()])
                    .flat()
                    .reduce((prev, curr) => prev + curr, 0);
    }
    /**
     * Parses the input sentence and returns a list of semantic chunks.
     *
     * @param sentence An input sentence.
     * @return The retrieved chunks.
     */
    parse(sentence) {
        if (sentence === '')
            return [];
        const boundaries = this.parseBoundaries(sentence);
        const result = [];
        let start = 0;
        for (const boundary of boundaries) {
            result.push(sentence.slice(start, boundary));
            start = boundary;
        }
        result.push(sentence.slice(start));
        return result;
    }
    /**
     * Parses the input sentence and returns a list of boundaries.
     *
     * @param sentence An input sentence.
     * @return The list of boundaries.
     */
    parseBoundaries(sentence) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const result = [];
        for (let i = 1; i < sentence.length; i++) {
            let score = this.baseScore;
            // NOTE: Score values in models may be negative.
            /* eslint-disable */
            score += ((_a = this.model.get('UW1')) === null || _a === void 0 ? void 0 : _a.get(sentence.substring(i - 3, i - 2))) || 0;
            score += ((_b = this.model.get('UW2')) === null || _b === void 0 ? void 0 : _b.get(sentence.substring(i - 2, i - 1))) || 0;
            score += ((_c = this.model.get('UW3')) === null || _c === void 0 ? void 0 : _c.get(sentence.substring(i - 1, i))) || 0;
            score += ((_d = this.model.get('UW4')) === null || _d === void 0 ? void 0 : _d.get(sentence.substring(i, i + 1))) || 0;
            score += ((_e = this.model.get('UW5')) === null || _e === void 0 ? void 0 : _e.get(sentence.substring(i + 1, i + 2))) || 0;
            score += ((_f = this.model.get('UW6')) === null || _f === void 0 ? void 0 : _f.get(sentence.substring(i + 2, i + 3))) || 0;
            score += ((_g = this.model.get('BW1')) === null || _g === void 0 ? void 0 : _g.get(sentence.substring(i - 2, i))) || 0;
            score += ((_h = this.model.get('BW2')) === null || _h === void 0 ? void 0 : _h.get(sentence.substring(i - 1, i + 1))) || 0;
            score += ((_j = this.model.get('BW3')) === null || _j === void 0 ? void 0 : _j.get(sentence.substring(i, i + 2))) || 0;
            score += ((_k = this.model.get('TW1')) === null || _k === void 0 ? void 0 : _k.get(sentence.substring(i - 3, i))) || 0;
            score += ((_l = this.model.get('TW2')) === null || _l === void 0 ? void 0 : _l.get(sentence.substring(i - 2, i + 1))) || 0;
            score += ((_m = this.model.get('TW3')) === null || _m === void 0 ? void 0 : _m.get(sentence.substring(i - 1, i + 2))) || 0;
            score += ((_o = this.model.get('TW4')) === null || _o === void 0 ? void 0 : _o.get(sentence.substring(i, i + 3))) || 0;
            /* eslint-enable */
            if (score > 0)
                result.push(i);
        }
        return result;
    }
}
