/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* global _:true, Cookies:true*/
/* eslint no-unused-vars: "warn"*/
'use strict';

var resize = require('./demo.js').resize;
var scrollToElement = require('./demo.js').scrollToElement;

/*
 * Setups the "Try Out" and "Test" panels.
 * It connects listeners to the DOM elements in the panel to allow
 * users to select an existing image or upload a file.
 * @param params.panel {String} The panel name that will be use to locate the DOM elements.
 */

function setupUse(params) {
  var panel = params.panel || 'use';
  console.log('setupUse()', panel);

  // panel ids
  var pclass = '.' + panel + '--';
  var pid = '#' + panel + '--';

  // jquery elements we are using
  var $loading = $(pclass + 'loading');
  var $result = $(pclass + 'output');
  var $error = $(pclass + 'error');
  var $errorMsg = $(pclass + 'error-message');
  var $tbody = $(pclass + 'output-tbody');
  var $image = $(pclass + 'output-image');
  var $urlInput = $(pclass + 'url-input');
  var $imageDataInput = $(pclass + 'image-data-input');
  var $radioImages = $(pclass + 'example-radio');
  var $invalidImageUrl = $(pclass + 'invalid-image-url').hide();
  var $invalidUrl = $(pclass + 'invalid-url').show();
  var $dropzone = $(pclass + 'dropzone');
  var $fileupload = $(pid + 'fileupload');
  var $outputData = $(pclass + 'output-data');

  /*
   * Resets the panel
   */
  function reset() {
    $loading.hide();
    $result.hide();
    $error.hide();
    resetPasteUrl();
    $urlInput.val('');
    $tbody.empty();
    $dropzone.find('label').removeClass('dragover');
    $outputData.empty();
  }

  // init reset
  reset();

  function processImage() {
    reset();
    $loading.show();
    scrollToElement($loading);
  }

  /*
   * Shows the result from classifing an image
   */
  function showResult(results) {
    $loading.hide();
    $error.hide();

    if (!results || !results.images || !results.images[0]) {
      showError('Error processing the request, please try again later.');
      return;
    }

    if (results.images[0].error) {
      var error = results.images[0].error;
      if (error.description && error.description.indexOf('Individual size limit exceeded') === 0) {
        showError('The file size exceeds the limit allowed. The maximum file size is 2 MB.');
        return;
      } else if (results.images[0].error.error_id === 'input_error') {
        showError("We couldn't not retrieve that URL, please check your URL and try again.");
        return;
      }
    }

    // populate table
    renderTable(results);
    $result.show();

    // check if there are results or not
    if (!$('.classes-table').is(':visible') &&
        !$('.faces-table').is(':visible') &&
        !$('.words-table').is(':visible') &&
        !results.classifier_ids) {
      $('.classes-table').after(
        $('<div class="' + panel + '--mismatch" />')
        .html('No matching classifiers found.'));
    }

    var outputImage = document.querySelector('.use--output-image');
    if (outputImage && (outputImage.height > outputImage.width)) {
      $(outputImage).addClass('landscape');
    }
    scrollToElement($result);
  }

  function showError(message) {
    $error.show();
    $errorMsg.html(message);
    console.log($error, $errorMsg);
  }

  function _error(xhr) {
    $loading.hide();
    var message = 'Error classifing the image';
    if (xhr.responseJSON) {
      message = xhr.responseJSON.error;
    }
    showError(message);
  }

  /*
   * submit event
   */
  function classifyImage(imgPath, imageData) {
    processImage();
    if (imgPath !== '') {
      $image.attr('src', imgPath);
      $urlInput.val(imgPath);
    }

    $imageDataInput.val(imageData);

    // Grab all form data
    $.post('/api/classify', $(pclass + 'form').serialize())
      .done(showResult)
      .error(function(error) {
        $loading.hide();
        console.log(error);

        if (error.status === 429) {
          showError('You have entered too many requests at once. Please try again later.');
        } else if (error.responseJSON && error.responseJSON.error) {
          showError('We had a problem classifying that image because ' + error.responseJSON.error);
        } else {
          showError('The demo is not available right now. <br/>We are working on ' +
              'getting this back up and running soon.');
        }
      });
  }

  /*
   * Prevent default form submission
   */
  $fileupload.submit(false);

  /*
   * Radio image submission
   */
  $radioImages.click(function() {
    console.log('clicked');
    resetPasteUrl();
    var imgPath = $(this).next('label').find('img').attr('src');
    classifyImage(imgPath);
    $urlInput.val('');
  });

  /*
   * Image url submission
   */
  $urlInput.keypress(function(e) {
    var url = $(this).val();
    var self = $(this);

    if (e.keyCode === 13) {
      $invalidUrl.hide();
      $invalidImageUrl.hide();
      resetPasteUrl();
      classifyImage(url);
      self.blur();
    }

    $(self).focus();
  });

  function resetPasteUrl() {
    $urlInput.removeClass(panel + '--url-input_error');
    $invalidUrl.hide();
    $invalidImageUrl.hide();
  }
  /**
   * Jquery file upload configuration
   * See details: https://github.com/blueimp/jQuery-File-Upload
   */
  $fileupload.fileupload({
    dataType: 'json',
    dropZone: $dropzone,
    acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,
    add: function(e, data) {
      data.url = '/api/classify';
      if (data.files && data.files[0]) {
        $error.hide();

        processImage();
        var reader = new FileReader();
        reader.onload = function() {
          var image = new Image();
          image.src = reader.result;
          image.onload = function() {
            $image.attr('src', this.src);
            classifyImage('', resize(image, 2048));
          };
        };
        reader.readAsDataURL(data.files[0]);
      }
    },
    error: _error,
    done: function(e, data) {
      showResult(data.result);
    }
  });

  $(document).on('dragover', function() {
    $(pclass + 'dropzone label').addClass('dragover');
  });

  $(document).on('dragleave', function() {
    $(pclass + 'dropzone label').removeClass('dragover');
  });

  function roundScore(score) {
    return Math.round(score * 100) / 100;
  }

  function slashesToArrows(typeHierarchy) {
    var results = typeHierarchy;
    results = results.replace(/^\/|\/$/g, ''); // trim first / and last /
    results = results.replace(/\//g, ' > ');  // change slashes to >'s
    return results;
  }

  function lookupInMap(mapToCheck, kind, token, defaultValue) {
    var res = mapToCheck[kind][token];
    if (res) {
      return res;
    } else {
      return defaultValue;
    }
  }

  function getAndParseCookieName(cookieName, defaultValue) {
    var res = Cookies.get(cookieName);
    if (res) {
      return JSON.parse(res);
    } else {
      return defaultValue;
    }
  }

  function renderTable(results) {
    $('.' + panel + '--mismatch').remove();

    if (results.images && results.images.length > 0) {
      if (results.images[0].resolved_url) {
        $image.attr('src', results.images[0].resolved_url);
      }
    }

    // eslint-disable-next-line camelcase
    var useResultsTable_template = useResultsTableTemplate.innerHTML;

    var classNameMap = getAndParseCookieName('classNameMap', {});
    var bundle = getAndParseCookieName('bundle', {});

    // classes
    if ((results.images &&
      results.images[0].classifiers &&
      results.images[0].classifiers.length > 0 &&
      results.images[0].classifiers[0].classes !== 'undefined') &&
      results.images[0].classifiers[0].classes.length > 0) {
      var classesModel = (function() {
        var classes = results.images[0].classifiers[0].classes.map(function(item) {
          return {
            name: results.classifier_ids ? lookupInMap(classNameMap, bundle.kind, item.class, item.class) : item.class,
            score: roundScore(item.score),
            type_hierarchy: slashesToArrows(item.type_hierarchy)
          };
        });

        return {
          resultCategory: 'Classes',
          data: classes
        };
      })();

      // $('.classes-table').show();
      $outputData.append(_.template(useResultsTable_template, {
        items: classesModel
      }));
    } else if (results.classifier_ids) {
      var classes = bundle.names[0];
      if (bundle.names.length > 1) {
        classes = bundle.names.slice(0, -1).join(', ') + ' or ' + bundle.names.slice(-1);
      }
      $('.classes-table').html('<div class="' + panel + '--mismatch">This image is not a match for ' + bundle.name + ': ' + classes + '.</div>');
      $('.classes-table').show();
    } else {
      $('.classes-table').hide();
    }

    // faces
    if ((typeof results.images[0].faces !== 'undefined') && (results.images[0].faces.length > 0)) {
      var facesModel = (function() {
        var identities = [];
        var faces = results.images[0].faces.reduce(function(acc, facedat) {
          // gender
          acc.push({
            name: facedat.gender.gender.toLowerCase(),
            score: roundScore(facedat.gender.score)
          });

          // age
          acc.push({
            name: 'age ' + facedat.age.min + ' - ' + facedat.age.max,
            score: roundScore(facedat.age.score)
          });

          // identity
          if (typeof facedat.identity !== 'undefined') {
            identities.push({
              name: facedat.identity.name,
              score: roundScore(facedat.identity.score),
              type_hierarchy: facedat.identity.type_hierarchy ? slashesToArrows(facedat.identity.type_hierarchy) : false
            });
          }
          return acc;
        }, []);

        return {
          resultCategory: 'Faces',
          identities: identities,
          data: faces
        };
      })();

      console.log(facesModel);

      // $('.faces-table').show();
      $outputData.append(_.template(useResultsTable_template, {
        items: facesModel
      }));
    } else {
      $('.faces-table').hide();
    }

    // words
    if ((typeof results.images[0].words !== 'undefined') && (results.images[0].words.length > 0)) {
      var wordsModel = (function() {
        var words = results.images[0].words.map(function(item) {
          return {
            name: item.word,
            score: roundScore(item.score)
          };
        });
        return {
          resultCategory: 'Words',
          data: words
        };
      })();

      // $('.words-table').show();
      $outputData.append(_.template(useResultsTable_template, {
        items: wordsModel
      }));
    } else {
      $('.words-table').hide();
    }
  }
}

module.exports = setupUse;
