// -----------------------------------------------------------------------
// Copyright (c) 2008, Stone Steps Inc.
// All rights reserved
// http://www.stonesteps.ca/legal/bsd-license/
//
// This is a BBCode parser written in JavaScript. The parser is intended
// to demonstrate how to parse text containing BBCode tags in one pass
// using regular expressions.
//
// The parser may be used as a backend component in ASP or in the browser,
// after the text containing BBCode tags has been served to the client.
//
// Following BBCode expressions are recognized:
//
// [b]bold[/b]
// [i]italic[/i]
// [u]underlined[/u]
// [s]strike-through[/s]
// [samp]sample[/samp]
//
// [color=red]red[/color]
// [color=#FF0000]red[/color]
// [size=1.2]1.2em[/size]
//
// [url]http://blogs.stonesteps.ca/showpost.asp?pid=33[/url]
// [url=http://blogs.stonesteps.ca/showpost.asp?pid=33][b]BBCode[/b] Parser[/url]
// [url="http://blogs.stonesteps.ca/showpost.asp?pid=33"][b]BBCode[/b] Parser[/url]
//
// [q=http://blogs.stonesteps.ca/showpost.asp?pid=33]inline quote[/q]
// [q]inline quote[/q]
// [quote=http://blogs.stonesteps.ca/showpost.asp?pid=33]inline quote[/quote]
// [quote]inline quote[/quote]
// [blockquote=http://blogs.stonesteps.ca/showpost.asp?pid=33]block quote[/blockquote]
// [blockquote]block quote[/blockquote]
//
// [pre]formatted
//     text[/pre]
// [code]if(a == b)
//   print("done");[/code]
//
// text containing [noparse] [brackets][/noparse]
//
// -----------------------------------------------------------------------

//
// post must be HTML-encoded
//
exports.parse = function (post, cb) {
  var opentags = []      // open tag stack
  var crlf2br = true     // convert CRLF to <br>?
  var noparse = false    // ignore BBCode tags?

  var urlstart = -1      // beginning of the URL if zero or greater (ignored if -1)

  // acceptable BBcode tags, optionally prefixed with a slash
  var tagname_re = /^\/?(?:b|i|u|pre|center|samp|code|colou?r|size|noparse|url|link|s|q|(block)?quote|img|u?list|li)$/i

  // color names or hex color
  var color_re = /^(:?black|silver|gray|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua|#(?:[0-9a-f]{3})?[0-9a-f]{3})$/i

  // numbers
  var number_re = /^[\\.0-9]{1,8}$/i

  // reserved, unreserved, escaped and alpha-numeric [RFC2396]
  var uri_re = /^[-;\/\?:@&=\+\$,_\.!~\*'\(\)%0-9a-z]{1,512}$/i

  // main regular expression: CRLF, [tag=option], [tag="option"] [tag] or [/tag]
  // eslint-disable-next-line no-control-regex
  var postfmt_re = /([\r\n])|(?:\[([a-z]{1,16})(?:=(?:"|'|)([^\x00-"'\(\)<>\[\]]{1,256}))?(?:"|'|)\])|(?:\[\/([a-z]{1,16})\])/ig

  // stack frame object
  function taginfo_t(bbtag, etag) {
    return { bbtag, etag }
  }

  // check if it's a valid BBCode tag
  function isValidTag(str) {
    return !str || !str.length ? false : tagname_re.test(str)
  }

  //
  // m1 - CR or LF
  // m2 - the tag of the [tag=option] expression
  // m3 - the option of the [tag=option] expression
  // m4 - the end tag of the [/tag] expression
  //
  function textToHtmlCB(mstr, m1, m2, m3, m4, offset, string) {

    //
    // Do not translate unbalanced opening tags
    //
    if ( m2 && !string.slice(offset).includes(`[/${m2}]`) ) {
      return mstr
    }

    //
    // CR LF sequences
    //
    if ( m1 && m1.length ) {
      if ( !crlf2br ) {
        return mstr
      }

      switch ( m1 ) {
        case '\r': return ''
        case '\n': return '<br>'
      }
    }

    //
    // handle start tags
    //
    if ( isValidTag(m2) ) {
      var m2l = m2.toLowerCase()

      // if in the noparse state, just echo the tag
      if ( noparse ) {
        return mstr
      }

      // ignore any tags if there's an open option-less [url] tag
      if ( opentags.length && (opentags.slice(-1)[0].bbtag == 'url' ||
          opentags.slice(-1)[0].bbtag == 'link') && urlstart >= 0) {
        return mstr
      }

      switch ( m2l ) {
        case 'code':
          opentags.push(new taginfo_t(m2l, '</code></pre>'))
          noparse = true
          crlf2br = false
          return '<pre><code>'

        case 'pre':
          opentags.push(new taginfo_t(m2l, '</pre>'))
          crlf2br = false
          return '<pre>'

        case 'center':
          opentags.push(new taginfo_t(m2l, '</center>'))
          crlf2br = false
          return '<center>'

        case 'color':
        case 'colour':
          if(!m3 || !color_re.test(m3))
            m3 = 'inherit'
          opentags.push(new taginfo_t(m2l, '</span>'))
          return `<span style="color: ${m3}">`

        case 'size':
          if(!m3 || !number_re.test(m3))
            m3 = '1'
          opentags.push(new taginfo_t(m2l, '</span>'))
          return `<span style="font-size: ${Math.min(Math.max(m3, 0.7), 3)}em">`

        case 's':
          opentags.push(new taginfo_t(m2l, '</span>'))
          return '<span style="text-decoration: line-through">'

        case 'noparse':
          noparse = true
          return ''

        case 'link':
        case 'url':
          opentags.push(new taginfo_t(m2l, '</a>'))

          // check if there's a valid option
          if ( m3 && uri_re.test(m3) ) {
            // if there is, output a complete start anchor tag
            urlstart = -1
            return `<a target="_blank" href="${m3}">`
          }

          // otherwise, remember the URL offset
          urlstart = mstr.length + offset

          // and treat the text following [url] as a URL
          return '<a target="_blank" href="'
        case 'img':
          opentags.push(new taginfo_t(m2l, '" />'))

          if ( m3  && uri_re.test(m3) ) {
            urlstart = -1
            return `<${m2l} src="${m3}`
          }

          return `<${m2l} src="`

        case 'q':
        case 'quote':
        case 'blockquote':
          var tag = (m2l === 'q') ? 'q' : 'blockquote'
          opentags.push(new taginfo_t(m2l, `</${tag}>`))
          return m3 && m3.length && uri_re.test(m3) ?
            `<${tag} cite="${m3}">` : `<${tag}>`

        case 'list':
          opentags.push(new taginfo_t('list', '</ol>'))
          return '<ol>'

        case 'ulist':
          opentags.push(new taginfo_t('ulist', '</ul>'))
          return '<ul>'

        case 'b':
          opentags.push(new taginfo_t('b', '</strong>'))
          return '<strong>'

        case 'i':
          opentags.push(new taginfo_t('i', '</em>'))
          return '<em>'

        default:
          // [samp] and [u] don't need special processing
          opentags.push(new taginfo_t(m2l, `</${m2l}>`))
          return `<${m2l}>`

      }
    }

    //
    // process end tags
    //
    if ( isValidTag(m4) ) {
      const m4l = m4.toLowerCase()

      if ( noparse ) {
        // if it's the closing noparse tag, flip the noparse state
        if ( m4 == 'noparse' ) {
          noparse = false
          return ''
        } else if ( m4 == 'code') {
          noparse = false
          crlf2br = true
          return opentags.pop().etag
        }
        // otherwise just output the original text
        return mstr
      }

      // highlight mismatched end tags
      if( !opentags.length || opentags.slice(-1)[0].bbtag != m4l ) {
        return mstr
      }

      if ( m4l == 'url' || m4l == 'link' ) {
        // if there was no option, use the content of the [url] tag
        if ( urlstart > 0 ) {
          return `">${string.substr(urlstart, offset-urlstart)}${opentags.pop().etag}`
        }
        // otherwise just close the tag
        return opentags.pop().etag
      } else if ( m4l == 'code' || m4l == 'pre' ) {
        crlf2br = true
      }

      // other tags require no special processing, just output the end tag
      return opentags.pop().etag
    }

    return mstr
  }

  // actual parsing can begin
  var result = ''

  // convert CRLF to <br> by default
  crlf2br = true

  // create a new array for open tags
  if ( opentags == null || opentags.length ) {
    opentags = new Array(0)
  }

  // run the text through main regular expression matcher
  if ( post ) {
    // markdown style lists
    post = (function (_post) {
      const pattern = /^\* (.*?)(\[\/[a-z]{1,16}\]|$)/gm
      return _post.replace(pattern, (mstr, m1, m2) => `[li]${m1}[/li]${m2}` )
    })(post)
    result = post
      .replace(postfmt_re, textToHtmlCB)
      // remove line breaks right after closing tags
      .replace(/(<\/[a-z]{1,16}>)<br>/, (mstr, m1) => m1 )
  }
  return cb ? cb(result) : result
}
