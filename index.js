'use strict'
const $ = require('jquery')
window.jQuery = $
const linkifyHtml = require('linkifyjs/html')
const bbcode = require('./lib/bbcode')
require('bootstrap/dist/js/bootstrap')
require('./lib/grid')($)


$(document).ready(function () {
  // Ensure author div and content div stay the same size
  // supporting code in grid.js
  $('.equal-divs').equalHeight()
  // Ensure presentation is ok while media still loading
  var x = setInterval(function () {
    $('.equal-divs').equalHeight()
  }, 500)
  $(window).load(function () {
    // Stops presentation refresh when everything loaded
    clearInterval(x)
  })

  // Post customization
  $('.post-content img').load(function () {
      if ($(this).width() > 100) {
        $(this).addClass('img-responsive')
      }
  })
  $('.panel-body .panel').remove()  // Remove inner spoiler tags
  $('blockquote blockquote').remove()
  $('.post-content a').attr('target', '_blank')
  $('.post-content div.embed-responsive').next('a').remove()
  $('.post-content video').next('a').remove()

  // Repair post_path template rendering in post_list
  var $postCrumb = $('a.post-crumb')
  if ( !$postCrumb.parent().next().length ) {
    $postCrumb.parent().addClass('active')
    $postCrumb.replaceWith(function () {
      return $(this).text()
    })
  }

  // Move messages after breadcrumb
  $('.breadcrumb').first().after($('.messages'))

  // Animate poll results
  var $chart = $('.poll-chart')
  var $bar = $('.poll-bar')
  var highestNumber = 0
  var sum = 0
  // Get highest number and use that as 100%
  $chart.find($bar).each(function () {
      var num = parseInt($(this).text(),10)
      sum += num
      if (num > highestNumber) {
          highestNumber = num
      }
  })
  // Set the progress bar data
  $chart.find($bar).each(function () {
      const num = $(this).text()
      // Convert to percentage and round
      const dispPerc = Math.round((num / highestNumber) * 100)
      const realPerc = Math.round((num / sum) * 100)
      if(!isNaN(realPerc) && realPerc !== 0) {
          $(this).animate({width: dispPerc + '%'}, {duration:'fast'})
          $(this).text(Math.round(realPerc) + '%')
          $(this).attr('aria-valuenow', dispPerc)
      } else {
          $(this).text('')
      }
  })
  // PostView author popover
  $('.author').popover({
    html: true,
    trigger: 'focus',
    placement: 'bottom',
  })
  $(document).on('click', '.send-pm', function () {
    var user = $(this).parents('div.popover').siblings('a.author')
    var user_id = user.attr('data-id')
    var user_name = user.text()
    $('#pmModal').text('Envoyer un message privé à ' + user_name)
    $('.modal-content #id_recipient').attr('value', user_id)
    $('#full-editor-link').attr(
      'href', $('#full-editor-link').attr('href') + '/' + user_id)
  })

  // Ensure presentation is ok while spoiler animation is playing
  // Give spoiler tags unique ids and hyperlink adresses
  $('div[id^=\'spoiler-panel\']').attr('id', function (index) {
    return 'spoiler-panel-' + (index+1)
  })
  $('a[href^=\'#spoiler-panel\']').attr('href', function (index) {
    return '#spoiler-panel-' + (index+1)
  })
  $('a[href^=\'#spoiler-panel-\']').click(function () {
    const $spoiler = $(this)
    var spoiler_anim = setInterval(function () {
      const $container = $spoiler.parents('.spoiler-container')
      $container.children('div[id^=\'spoiler-panel-\']')
        .on('shown.bs.collapse', function () {
          clearInterval(spoiler_anim)
      })
      $container.children('div[id^=\'spoiler-panel-\']')
        .on('hidden.bs.collapse', function () {
          clearInterval(spoiler_anim)
      })
      const $row = $spoiler.parents('.row')
      $row.children('.equal-divs').responsiveEqualHeightGrid()
    }, 20)
  })

  $('#submit').on('click', function () {
    $('.post-content').html(
      linkifyHtml(bbcode.parse($('#id_content_plain').val()),
        { defaultProtocol: 'https' })
      )
    $('.equal-divs').responsiveEqualHeightGrid()
  })
})
