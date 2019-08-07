// @ts-nocheck
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
// import { ReactiveDict } from 'meteor/reactive-dict';
import './components/spinner/spinner.js';
import './fireplace.html';
import './icons/zoom.html';
import './icons/arrow.html';
import './icons/x.html';
import './icons/maximize.html';
import './icons/minimize.html';
import './styles.css';

const DEFAULT_TEMPLATES = {
  ARROW_LEFT: 'FireplaceArrowRight',
  ARROW_RIGHT: 'FireplaceArrowLeft',
  CLOSE: 'FireplaceX',
  ZOOM: 'FireplaceZoom',
  FULLSCREEN_ENTER: 'FireplaceMaximize',
  FULLSCREEN_EXIT: 'FireplaceMinimize',
  SPINNER: 'FireplaceSpinner'
};

const IMAGE_CONTAINER_CLASSES = {
  cover: 'fireplace--cover',
  contain: 'fireplace--contain'
};

const LAYOUT_MODES = {
  cover: 'cover',
  contain: 'contain',
  auto: 'auto'
};

const WRAPPER_CLASSES = {
  reveal: 'fireplace-reveal'
};

const validateLayoutProp = (layout) => {
  if (layout && !Object.keys(LAYOUT_MODES).includes(layout)) {
    throw new Meteor.Error('validation-error', `Invalid value for prop 'layout': '${layout}'. Was expecting 'cover', 'contain' or 'auto'`);
  }
};

const validateMaxImageWidthProp = (maxImageWidth) => {
  if (maxImageWidth && !Number.isInteger(maxImageWidth)) {
    throw new Meteor.Error('validation-error', `Invalid value for prop 'maxImageWidth': '${maxImageWidth}'. Was expecting an Integer.`)
  }
};

const validateImagesProp = (images) => {
  if (!Array.isArray(images)) {
    throw new Meteor.Error('validation-error', `Invalid value for prop 'images': ${images}. Was expecting an Array.`);
  }

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image.src || typeof image.src !== 'string') {
      throw new Meteor.Error('validation-error', `Invalid value for prop 'images.src': ${image.src}. Was expecting a String.`);
    } else if (
      image.srcSet &&
      (typeof image.srcSet !== 'string' && !Array.isArray(image.srcSet))
    ) {
      throw new Meteor.Error('validation-error', `Invalid value for prop 'images.srcSet': ${image.srcSet}. Was expecting a String or Array.`);
    } else if (image.caption && typeof image.caption !== 'string') {
      throw new Meteor.Error('validation-error', `Invalid value for prop 'images.caption': ${image.caption}. Was expecting a String.`);
    }
  }
};

const validateBackgroundProp = (background) => {
  if (background && !typeof background !== 'string') {
    throw new Meteor.Error('validation-error', `Invalid value for prop 'background': ${background}. Was expecting a String.`);
  }
};

const requestFullscreen = (rootElement) => {
  if (rootElement.requestFullscreen) {
    return rootElement.requestFullscreen()
  } else if (rootElement.mozRequestFullScreen) {
    return rootElement.mozRequestFullScreen()
  } else if (rootElement.webkitRequestFullscreen) {
    return rootElement.webkitRequestFullscreen()
  } else if (rootElement.msRequestFullscreen) {
    return rootElement.msRequestFullscreen();
  } else {
    return Promise.reject();
  }
};

const isFullscreenAvailable = () => {
  return !!(document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled);
};

const isFullscreenActive = () => {
  return !!(document.fullscreenElement ||
    document.msFullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullscreenElement);
};

const requestExitFullscreen = () => {
  if (document.exitFullscreen) {
    return document.exitFullscreen()
  } else if (document.mozCancelFullScreen) {
    return document.mozCancelFullScreen()
  } else if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen()
  } else if (document.msExitFullscreen) {
    return document.msExitFullscreen()
  } else {
    return Promise.resolve();
  }
};

const PRELOADED = [];

const preload = (image) => {
  return new Promise((resolve) => {
    if (!image) {
      return resolve(); // no-op
    }

    if (PRELOADED.includes(image.src)) {
      return resolve(); // no-op
    }

    const imgEl = new Image();
    imgEl.onload = function () {
      PRELOADED.push(image.src);
      resolve(imgEl);
    }
    imgEl.srcset = image.srcSet;
    imgEl.sizes = '100vw';
    imgEl.src = image.src;
  });
};

const resolveLayoutMode = (layout) => {
  if (layout === LAYOUT_MODES.auto) {
    return window.innerHeight > window.innerWidth ?
      LAYOUT_MODES.contain : LAYOUT_MODES.cover;
  }
  return layout;
};

Template.Fireplace.onCreated(function onFireplaceCreated() {
  this.autorun(() => {
    const data = Template.currentData();
    if (data) {
      validateLayoutProp(data.layout);
      validateMaxImageWidthProp(data.maxImageWidth);
      validateImagesProp(data.images);
      validateBackgroundProp(data.background);
    }
  });

  const startIndex = Number.parseInt(this.data.startIndex, 10) || 0;
  const images = this.data.images;

  /* STATE */
  this.currentIndex = new ReactiveVar(startIndex);
  this.fullscreenActive = new ReactiveVar(false);
  this.loading = new ReactiveVar(true);
  this.layoutMode = new ReactiveVar(this.data.layout);

  /* Preload the initial images +1 from both directions */
  const beforeImage = images[startIndex - 1];
  const nextImage = images[startIndex + 1];

  preload(images[startIndex])
    .then(() => this.loading.set(false))
    .then(() => preload(beforeImage))
    .then(() => preload(nextImage))

  /* Add keydown handler for arrow navigation and ESC */
  this.keyHandler = (event) => {
    if (event.keyCode == 37) {
      this.navigate(-1)
    } else if (event.keyCode == 39) {
      this.navigate(1)
    } else if (event.keyCode == 27) {
      this.data.onCloseRequested();
    }
  };

  document.addEventListener('keydown', this.keyHandler);

  this.navigate = (delta) => {
    const images = this.data.images;
    const current = this.currentIndex.get();
    const maxIndex = images.length - 1;
    const nextIndex = Math.max(0, Math.min(current + delta, maxIndex));
    const oneAfter = Math.max(0, Math.min(nextIndex + delta, maxIndex));
    const twoAfter = Math.max(0, Math.min(nextIndex + (delta * 2), maxIndex));

    if (current !== nextIndex) {
      this.currentIndex.set(nextIndex);
      this.loaderTimeout = setTimeout(() => this.loading.set(true), 50);

      preload(images[oneAfter]).then(() => {
        preload(images[twoAfter]);
      });
    }
  };

  this.toggleFullscreen = () => {
    if (isFullscreenActive()) {
      requestExitFullscreen();
    } else {
      requestFullscreen(this.firstNode);
    }
  };

  this.toggleLayoutMode = () => {
    const currentLayout = resolveLayoutMode(this.layoutMode.get());
    if (currentLayout === LAYOUT_MODES.contain) {
      this.layoutMode.set(LAYOUT_MODES.cover);
    } else {
      this.layoutMode.set(LAYOUT_MODES.contain);
    }
  }

  this.fullscreenStateHandler = (event) => {
    this.fullscreenActive.set(isFullscreenActive());
  };

  document.onfullscreenchange = this.fullscreenStateHandler;
  document.onmozfullscreenchange = this.fullscreenStateHandler;
  document.onMSFullscreenChange = this.fullscreenStateHandler;
});

Template.Fireplace.onRendered(function onFireplaceCreated() {
  this.firstNode.classList.add(WRAPPER_CLASSES.reveal);
});

Template.Fireplace.onDestroyed(function onFireplaceCreated() {
  document.removeEventListener('keydown', this.keyHandler);
});

Template.Fireplace.helpers({
  nextTmpl(customTemplate) {
    return customTemplate || DEFAULT_TEMPLATES.ARROW_LEFT;
  },

  prevTmpl(customTemplate) {
    return customTemplate || DEFAULT_TEMPLATES.ARROW_RIGHT;
  },

  closeTmpl(customTemplate) {
    return customTemplate || DEFAULT_TEMPLATES.CLOSE;
  },

  spinnerTmpl(customTemplate) {
    return customTemplate || DEFAULT_TEMPLATES.SPINNER;
  },

  zoomTmpl(customTemplate) {
    return customTemplate || DEFAULT_TEMPLATES.ZOOM;
  },

  layoutMode() {
    const instance = Template.instance();
    return resolveLayoutMode(instance.layoutMode.get());
  },

  showCaption(image, layoutMode) {
    const isContainMode = layoutMode === LAYOUT_MODES.contain;

    if (isContainMode) return true;

    return !!image.caption || !!image.copyright;
  },

  isFullscreenAvailable() {
    return isFullscreenAvailable();
  },

  fullscreenTmpl(customEnterTmpl, customExitTmpl) {
    const instance = Template.instance();
    const isActive = instance.fullscreenActive.get();
    return isActive ?
      customExitTmpl || DEFAULT_TEMPLATES.FULLSCREEN_EXIT :
      customEnterTmpl || DEFAULT_TEMPLATES.FULLSCREEN_ENTER;
  },

  imageContainerClass(layout) {
    return layout ?
      IMAGE_CONTAINER_CLASSES[resolveLayoutMode(layout)] :
      IMAGE_CONTAINER_CLASSES.contain;
  },

  overlayStyles(background) {
    return background ? `background: ${background};` : '';
  },

  imageContainerStyles(maxImageWidth) {
    const isContained = resolveLayoutMode(Template.currentData().layout) === 'contain';
    return maxImageWidth && isContained ? `width: ${maxImageWidth}px` : '';
  },

  zoomButtonIconProps(layout) {
    const layoutMode = resolveLayoutMode(layout);
    if (layoutMode === LAYOUT_MODES.contain) {
      return { in: true };
    }
    return { in: false };
  },

  imageStyles(layout) {
    return layout ? `object-fit: ${resolveLayoutMode(layout)};` : '';
  },

  isPrevButtonDisabled() {
    const instance = Template.instance();
    const index = instance.currentIndex.get();
    return index === 0;
  },

  isNextButtonDisabled() {
    const instance = Template.instance();
    const index = instance.currentIndex.get();
    const maxIndex = instance.data.images.length - 1;
    return index === maxIndex;
  },

  formatSrcSetAttr(srcSet) {
    if (Array.isArray(srcSet)) {
      return srcSet.join(', ');
    }
    return srcSet;
  },

  imageCountLabel() {
    const instance = Template.instance();
    const currentIndex = instance.currentIndex.get() + 1;
    const maxIndex = instance.data.images.length;
    return `${currentIndex} / ${maxIndex}`;
  },

  currentImage() {
    const instance = Template.instance();
    const index = instance.currentIndex.get()
    return instance.data.images[index];
  },

  isLoading() {
    return Template.instance().loading.get();
  }
});

Template.Fireplace.events({
  'click .fireplace-button__prev'(event, templateInstance) {
    templateInstance.navigate(-1);
  },
  'click .fireplace-button__next'(event, templateInstance) {
    templateInstance.navigate(1);
  },
  'click .fireplace-fullscreen'(event, templateInstance) {
    templateInstance.toggleFullscreen();
  },
  'click .fireplace-close'(event, templateInstance) {
    templateInstance.firstNode.classList.remove(WRAPPER_CLASSES.reveal);
    Meteor.setTimeout(() => templateInstance.data.onCloseRequested(), 350);
  },
  'click .fireplace-zoom'(event, templateInstance) {
    templateInstance.toggleLayoutMode();
  },
  'load .fireplace-image'(event, templateInstance) {
    clearTimeout(templateInstance.loaderTimeout);
    templateInstance.loading.set(false);
  }
});