import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const html = '<ol start="2"><li>z</li></ol><a href="javascript:alert(1)">x</a>';

console.log(DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel", "start"],
    FORBID_TAGS: ["style", "iframe", "form", "input"],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
}));
