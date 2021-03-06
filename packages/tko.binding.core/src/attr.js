
import {
  setElementName, objectForEach
} from 'tko.utils';

import {
  unwrap
} from 'tko.observable';



var attrHtmlToJavascriptMap = { 'class': 'className', 'for': 'htmlFor' };

export var attr = {
    update: function(element, valueAccessor, allBindings) {
        var value = unwrap(valueAccessor()) || {};
        objectForEach(value, function(attrName, attrValue) {
            attrValue = unwrap(attrValue);

            // Find the namespace of this attribute, if any.
            // Defaulting to `null` should be ok, as
            //
            //  element.setAttributeNS( null, name, value ) ~ element.setAttribute( name, value )
            //  element.removetAttributeNS( null, name ) ~ element.removeAttribute( name )
            //
            var prefixLen = attrName.indexOf(':');
            var namespace = prefixLen < 0 ? null : element.lookupNamespaceURI( attrName.substr(0, prefixLen) );

            // To cover cases like "attr: { checked:someProp }", we want to remove the attribute entirely
            // when someProp is a "no value"-like value (strictly null, false, or undefined)
            // (because the absence of the "checked" attr is how to mark an element as not checked, etc.)
            var toRemove = (attrValue === false) || (attrValue === null) || (attrValue === undefined);

            if (toRemove) {
                element.removeAttributeNS(namespace, attrName);
            } else {
                element.setAttributeNS(namespace, attrName, attrValue.toString());
            }

            // Treat "name" specially - although you can think of it as an attribute, it also needs
            // special handling on older versions of IE (https://github.com/SteveSanderson/knockout/pull/333)
            // Deliberately being case-sensitive here because XHTML would regard "Name" as a different thing
            // entirely, and there's no strong reason to allow for such casing in HTML.
            if (attrName === "name") {
                setElementName(element, toRemove ? "" : attrValue.toString());
            }
        });
    }
};
