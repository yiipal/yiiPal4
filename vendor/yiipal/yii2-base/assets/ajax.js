(function ($, window, Yiipal) {
    Yiipal.ajax = Yiipal.ajax || {};
    Yiipal.ajax = function (base, element, element_settings) {
        var defaults = {
            event: 'mousedown',
            keypress: true,
            selector: '#' + base,
            effect: 'none',
            speed: 'none',
            method: 'replaceWith',
            progress: {
                type: 'loading',
                message: '加载中...'
            },
            submit: {
                'js': true
            }
        };

        $.extend(this, defaults, element_settings);

        this.commands = new Yiipal.AjaxCommands();

        this.element = element;
        this.element_settings = element_settings;

        // If there isn't a form, jQuery.ajax() will be used instead, allowing us to
        // bind Ajax to links as well.
        if (this.element.form) {
            this.$form = $(this.element.form);
        }

        // If no Ajax callback URL was given, use the link href or form action.
        if (!this.url) {
            if ($(element).is('a')) {
                this.url = $(element).attr('href');
            }
            else if (element.form) {
                this.url = this.$form.attr('action');
            }
        }

        this.url = this.url.replace(/\/nojs(\/|$|\?|#)/g, '/ajax$1');

        // Set the options for the ajaxSubmit function.
        // The 'this' variable will not persist inside of the options object.
        var ajax = this;
        ajax.options = {
            url: ajax.url,
            data: ajax.submit,
            beforeSerialize: function (element_settings, options) {
                return ajax.beforeSerialize(element_settings, options);
            },
            beforeSubmit: function (form_values, element_settings, options) {
                ajax.ajaxing = true;
                return ajax.beforeSubmit(form_values, element_settings, options);
            },
            beforeSend: function (xmlhttprequest, options) {
                ajax.ajaxing = true;
                return ajax.beforeSend(xmlhttprequest, options);
            },
            success: function (response, status) {
                // Sanity check for browser support (object expected).
                // When using iFrame uploads, responses must be returned as a string.
                if (typeof response === 'string') {
                    response = $.parseJSON(response);
                }
                return ajax.success(response, status);
            },
            complete: function (response, status) {
                ajax.ajaxing = false;
                if (status === 'error' || status === 'parsererror') {
                    return ajax.error(response, ajax.url);
                }
            },
            dataType: 'json',
            accepts: {
                json: element_settings.accepts || 'application/vnd.Yiipal-ajax'
            },
            type: 'POST'
        };

        if (element_settings.dialog) {
            ajax.options.data.dialogOptions = element_settings.dialog;
        }

        // Bind the ajaxSubmit function to the element event.
        $(ajax.element).on(element_settings.event, function (event) {
            return ajax.eventResponse(this, event);
        });

        // If necessary, enable keyboard submission so that Ajax behaviors
        // can be triggered through keyboard input as well as e.g. a mousedown
        // action.
        if (element_settings.keypress) {
            $(ajax.element).on('keypress', function (event) {
                return ajax.keypressResponse(this, event);
            });
        }

        // If necessary, prevent the browser default action of an additional event.
        // For example, prevent the browser default action of a click, even if the
        // AJAX behavior binds to mousedown.
        if (element_settings.prevent) {
            $(ajax.element).on(element_settings.prevent, false);
        }
    };



    /**
     * Handle a key press.
     *
     * The Ajax object will, if instructed, bind to a key press response. This
     * will test to see if the key press is valid to trigger this event and
     * if it is, trigger it for us and prevent other keypresses from triggering.
     * In this case we're handling RETURN and SPACEBAR keypresses (event codes 13
     * and 32. RETURN is often used to submit a form when in a textfield, and
     * SPACE is often used to activate an element without submitting.
     */
    Yiipal.ajax.prototype.keypressResponse = function (element, event) {
        // Create a synonym for this to reduce code confusion.
        var ajax = this;

        // Detect enter key and space bar and allow the standard response for them,
        // except for form elements of type 'text', 'tel', 'number' and 'textarea',
        // where the spacebar activation causes inappropriate activation if
        // #ajax['keypress'] is TRUE. On a text-type widget a space should always be a
        // space.
        if (event.which === 13 || (event.which === 32 && element.type !== 'text' &&
            element.type !== 'textarea' && element.type !== 'tel' && element.type !== 'number')) {
            event.preventDefault();
            event.stopPropagation();
            $(ajax.element_settings.element).trigger(ajax.element_settings.event);
        }
    };

    /**
     * Handle an event that triggers an Ajax response.
     *
     * When an event that triggers an Ajax response happens, this method will
     * perform the actual Ajax call. It is bound to the event using
     * bind() in the constructor, and it uses the options specified on the
     * ajax object.
     */
    Yiipal.ajax.prototype.eventResponse = function (element, event) {
        event.preventDefault();
        event.stopPropagation();

        // Create a synonym for this to reduce code confusion.
        var ajax = this;

        // Do not perform another ajax command if one is already in progress.
        if (ajax.ajaxing) {
            return;
        }

        try {
            if (ajax.$form) {
                // If setClick is set, we must set this to ensure that the button's
                // value is passed.
                if (ajax.setClick) {
                    // Mark the clicked button. 'form.clk' is a special variable for
                    // ajaxSubmit that tells the system which element got clicked to
                    // trigger the submit. Without it there would be no 'op' or
                    // equivalent.
                    element.form.clk = element;
                }

                ajax.$form.ajaxSubmit(ajax.options);
            }
            else {
                ajax.beforeSerialize(ajax.element, ajax.options);
                $.ajax(ajax.options);
            }
        }
        catch (e) {
            // Unset the ajax.ajaxing flag here because it won't be unset during
            // the complete response.
            ajax.ajaxing = false;
            window.alert("An error occurred while attempting to process " + ajax.options.url + ": " + e.message);
        }
    };

    /**
     * Handler for the form serialization.
     *
     * Runs before the beforeSend() handler (see below), and unlike that one, runs
     * before field data is collected.
     */
    Yiipal.ajax.prototype.beforeSerialize = function (element, options) {
        // Allow detaching behaviors to update field values before collecting them.
        // This is only needed when field values are added to the POST data, so only
        // when there is a form such that this.$form.ajaxSubmit() is used instead of
        // $.ajax(). When there is no form and $.ajax() is used, beforeSerialize()
        // isn't called, but don't rely on that: explicitly check this.$form.
        if (this.$form) {
            var settings = this.settings || YiipalSettings;
            Yiipal.detachBehaviors(this.$form.get(0), settings, 'serialize');
        }

        // Prevent duplicate HTML ids in the returned markup.
        // @see \Yiipal\Component\Utility\Html::getUniqueId()
        var ids = document.querySelectorAll('[id]');
        var ajaxHtmlIds = [];
        var il = ids.length;
        for (var i = 0; i < il; i++) {
            ajaxHtmlIds.push(ids[i].id);
        }
        // Join IDs to minimize request size.
        options.data.ajax_html_ids = ajaxHtmlIds.join(' ');

        // Allow Yiipal to return new JavaScript and CSS files to load without
        // returning the ones already loaded.
        // @see \Yiipal\Core\Theme\AjaxBasePageNegotiator
        // @see \Yiipal\Core\Asset\LibraryDependencyResolverInterface::getMinimalRepresentativeSubset()
        // @see system_js_settings_alter()
        var pageState = YiipalSettings.ajaxPageState;
        options.data['ajax_page_state[theme]'] = pageState.theme;
        options.data['ajax_page_state[theme_token]'] = pageState.theme_token;
        options.data['ajax_page_state[libraries]'] = pageState.libraries;
    };

    /**
     * Modify form values prior to form submission.
     */
    Yiipal.ajax.prototype.beforeSubmit = function (form_values, element, options) {
        // This function is left empty to make it simple to override for modules
        // that wish to add functionality here.
    };

    /**
     * Prepare the Ajax request before it is sent.
     */
    Yiipal.ajax.prototype.beforeSend = function (xmlhttprequest, options) {
        // For forms without file inputs, the jQuery Form plugin serializes the form
        // values, and then calls jQuery's $.ajax() function, which invokes this
        // handler. In this circumstance, options.extraData is never used. For forms
        // with file inputs, the jQuery Form plugin uses the browser's normal form
        // submission mechanism, but captures the response in a hidden IFRAME. In this
        // circumstance, it calls this handler first, and then appends hidden fields
        // to the form to submit the values in options.extraData. There is no simple
        // way to know which submission mechanism will be used, so we add to extraData
        // regardless, and allow it to be ignored in the former case.
        if (this.$form) {
            options.extraData = options.extraData || {};

            // Let the server know when the IFRAME submission mechanism is used. The
            // server can use this information to wrap the JSON response in a TEXTAREA,
            // as per http://jquery.malsup.com/form/#file-upload.
            options.extraData.ajax_iframe_upload = '1';

            // The triggering element is about to be disabled (see below), but if it
            // contains a value (e.g., a checkbox, textfield, select, etc.), ensure that
            // value is included in the submission. As per above, submissions that use
            // $.ajax() are already serialized prior to the element being disabled, so
            // this is only needed for IFRAME submissions.
            var v = $.fieldValue(this.element);
            if (v !== null) {
                options.extraData[this.element.name] = v;
            }
        }

        // Disable the element that received the change to prevent user interface
        // interaction while the Ajax request is in progress. ajax.ajaxing prevents
        // the element from triggering a new request, but does not prevent the user
        // from changing its value.
        $(this.element).prop('disabled', true);

        // Insert progressbar or throbber.
        if (this.progress.type === 'bar') {
            var progressBar = new Yiipal.ProgressBar('ajax-progress-' + this.element.id, $.noop, this.progress.method, $.noop);
            if (this.progress.message) {
                progressBar.setProgress(-1, this.progress.message);
            }
            if (this.progress.url) {
                progressBar.startMonitoring(this.progress.url, this.progress.interval || 1500);
            }
            this.progress.element = $(progressBar.element).addClass('ajax-progress ajax-progress-bar');
            this.progress.object = progressBar;
            $(this.element).after(this.progress.element);
        }
        else if (this.progress.type === 'throbber') {
            this.progress.element = $('<div class="ajax-progress ajax-progress-throbber"><div class="throbber">&nbsp;</div></div>');
            if (this.progress.message) {
                this.progress.element.find('.throbber').after('<div class="message">' + this.progress.message + '</div>');
            }
            $(this.element).after(this.progress.element);
        }
        else if (this.progress.type === 'fullscreen') {
            this.progress.element = $('<div class="ajax-progress ajax-progress-fullscreen">&nbsp;</div>');
            $('body').after(this.progress.element);
        }
    };

    /**
     * Handler for the form redirection completion.
     */
    Yiipal.ajax.prototype.success = function (response, status) {
        // Remove the progress element.
        if (this.progress.element) {
            $(this.progress.element).remove();
        }
        if (this.progress.object) {
            this.progress.object.stopMonitoring();
        }
        $(this.element).prop('disabled', false);

        for (var i in response) {
            if (response.hasOwnProperty(i) && response[i].command && this.commands[response[i].command]) {
                this.commands[response[i].command](this, response[i], status);
            }
        }

        // Reattach behaviors, if they were detached in beforeSerialize(). The
        // attachBehaviors() called on the new content from processing the response
        // commands is not sufficient, because behaviors from the entire form need
        // to be reattached.
        if (this.$form) {
            var settings = this.settings || YiipalSettings;
            Yiipal.attachBehaviors(this.$form.get(0), settings);
        }

        // Remove any response-specific settings so they don't get used on the next
        // call by mistake.
        this.settings = null;
    };

    /**
     * Build an effect object which tells us how to apply the effect when adding new HTML.
     */
    Yiipal.ajax.prototype.getEffect = function (response) {
        var type = response.effect || this.effect;
        var speed = response.speed || this.speed;

        var effect = {};
        if (type === 'none') {
            effect.showEffect = 'show';
            effect.hideEffect = 'hide';
            effect.showSpeed = '';
        }
        else if (type === 'fade') {
            effect.showEffect = 'fadeIn';
            effect.hideEffect = 'fadeOut';
            effect.showSpeed = speed;
        }
        else {
            effect.showEffect = type + 'Toggle';
            effect.hideEffect = type + 'Toggle';
            effect.showSpeed = speed;
        }

        return effect;
    };

    /**
     * Handler for the form redirection error.
     */
    Yiipal.ajax.prototype.error = function (response, uri) {
        // Remove the progress element.
        if (this.progress.element) {
            $(this.progress.element).remove();
        }
        if (this.progress.object) {
            this.progress.object.stopMonitoring();
        }
        // Undo hide.
        $(this.wrapper).show();
        // Re-enable the element.
        $(this.element).prop('disabled', false);
        // Reattach behaviors, if they were detached in beforeSerialize().
        if (this.$form) {
            var settings = response.settings || this.settings || YiipalSettings;
            Yiipal.attachBehaviors(this.$form.get(0), settings);
        }
        throw new Yiipal.AjaxError(response, uri);
    };

    /**
     * Provide a series of commands that the server can request the client perform.
     */
    Yiipal.AjaxCommands = function () {};
    Yiipal.AjaxCommands.prototype = {
        /**
         * Command to insert new content into the DOM.
         */
        insert: function (ajax, response, status) {
            // Get information from the response. If it is not there, default to
            // our presets.
            var wrapper = response.selector ? $(response.selector) : $(ajax.wrapper);
            var method = response.method || ajax.method;
            var effect = ajax.getEffect(response);
            var settings;

            // We don't know what response.data contains: it might be a string of text
            // without HTML, so don't rely on jQuery correctly interpreting
            // $(response.data) as new HTML rather than a CSS selector. Also, if
            // response.data contains top-level text nodes, they get lost with either
            // $(response.data) or $('<div></div>').replaceWith(response.data).
            var new_content_wrapped = $('<div></div>').html(response.data);
            var new_content = new_content_wrapped.contents();

            // For legacy reasons, the effects processing code assumes that new_content
            // consists of a single top-level element. Also, it has not been
            // sufficiently tested whether attachBehaviors() can be successfully called
            // with a context object that includes top-level text nodes. However, to
            // give developers full control of the HTML appearing in the page, and to
            // enable Ajax content to be inserted in places where DIV elements are not
            // allowed (e.g., within TABLE, TR, and SPAN parents), we check if the new
            // content satisfies the requirement of a single top-level element, and
            // only use the container DIV created above when it doesn't. For more
            // information, please see http://Yiipal.org/node/736066.
            if (new_content.length !== 1 || new_content.get(0).nodeType !== 1) {
                new_content = new_content_wrapped;
            }

            // If removing content from the wrapper, detach behaviors first.
            switch (method) {
                case 'html':
                case 'replaceWith':
                case 'replaceAll':
                case 'empty':
                case 'remove':
                    settings = response.settings || ajax.settings || YiipalSettings;
                    Yiipal.detachBehaviors(wrapper.get(0), settings);
            }

            // Add the new content to the page.
            wrapper[method](new_content);

            // Immediately hide the new content if we're using any effects.
            if (effect.showEffect !== 'show') {
                new_content.hide();
            }

            // Determine which effect to use and what content will receive the
            // effect, then show the new content.
            if (new_content.find('.ajax-new-content').length > 0) {
                new_content.find('.ajax-new-content').hide();
                new_content.show();
                new_content.find('.ajax-new-content')[effect.showEffect](effect.showSpeed);
            }
            else if (effect.showEffect !== 'show') {
                new_content[effect.showEffect](effect.showSpeed);
            }

            // Attach all JavaScript behaviors to the new content, if it was successfully
            // added to the page, this if statement allows #ajax['wrapper'] to be
            // optional.
            if (new_content.parents('html').length > 0) {
                // Apply any settings from the returned JSON if available.
                settings = response.settings || ajax.settings || YiipalSettings;
                Yiipal.attachBehaviors(new_content.get(0), settings);
            }
        },

        /**
         * Command to remove a chunk from the page.
         */
        remove: function (ajax, response, status) {
            var settings = response.settings || ajax.settings || YiipalSettings;
            $(response.selector).each(function () {
                Yiipal.detachBehaviors(this, settings);
            })
                .remove();
        },

        /**
         * Command to mark a chunk changed.
         */
        changed: function (ajax, response, status) {
            if (!$(response.selector).hasClass('ajax-changed')) {
                $(response.selector).addClass('ajax-changed');
                if (response.asterisk) {
                    $(response.selector).find(response.asterisk).append(' <abbr class="ajax-changed" title="' + Yiipal.t('Changed') + '">*</abbr> ');
                }
            }
        },

        /**
         * Command to provide an alert.
         */
        alert: function (ajax, response, status) {
            window.alert(response.text, response.title);
        },

        /**
         * Command to set the window.location, redirecting the browser.
         */
        redirect: function (ajax, response, status) {
            window.location = response.url;
        },

        /**
         * Command to provide the jQuery css() function.
         */
        css: function (ajax, response, status) {
            $(response.selector).css(response.argument);
        },

        /**
         * Command to set the settings that will be used for other commands in this response.
         */
        settings: function (ajax, response, status) {
            if (response.merge) {
                $.extend(true, YiipalSettings, response.settings);
            }
            else {
                ajax.settings = response.settings;
            }
        },

        /**
         * Command to attach data using jQuery's data API.
         */
        data: function (ajax, response, status) {
            $(response.selector).data(response.name, response.value);
        },

        /**
         * Command to apply a jQuery method.
         */
        invoke: function (ajax, response, status) {
            var $element = $(response.selector);
            $element[response.method].apply($element, response.args);
        },

        /**
         * Command to restripe a table.
         */
        restripe: function (ajax, response, status) {
            // :even and :odd are reversed because jQuery counts from 0 and
            // we count from 1, so we're out of sync.
            // Match immediate children of the parent element to allow nesting.
            $(response.selector).find('> tbody > tr:visible, > tr:visible')
                .removeClass('odd even')
                .filter(':even').addClass('odd').end()
                .filter(':odd').addClass('even');
        },

        /**
         * Command to update a form's build ID.
         */
        update_build_id: function (ajax, response, status) {
            $('input[name="form_build_id"][value="' + response.old + '"]').val(response.new);
        },

        /**
         * Command to add css.
         *
         * Uses the proprietary addImport method if available as browsers which
         * support that method ignore @import statements in dynamically added
         * stylesheets.
         */
        add_css: function (ajax, response, status) {
            // Add the styles in the normal way.
            $('head').prepend(response.data);
            // Add imports in the styles using the addImport method if available.
            var match;
            var importMatch = /^@import url\("(.*)"\);$/igm;
            if (document.styleSheets[0].addImport && importMatch.test(response.data)) {
                importMatch.lastIndex = 0;
                do {
                    match = importMatch.exec(response.data);
                    document.styleSheets[0].addImport(match[1]);
                } while (match);
            }
        }
    };




})(jQuery, this, Yiipal);