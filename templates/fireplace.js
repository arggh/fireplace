// @ts-nocheck
import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
// import { ReactiveDict } from 'meteor/reactive-dict';
import './components/spinner/spinner.js';
import './fireplace.html';
import './icons/arrow.html';
import './icons/x.html';
import './icons/maximize.html';
import './icons/minimize.html';
import './styles.css';

const DEFAULT_TEMPLATES = {
  ARROW_LEFT: 'FireplaceArrowRight',
  ARROW_RIGHT: 'FireplaceArrowLeft',
  CLOSE: 'FireplaceX',
  FULLSCREEN_ENTER: 'FireplaceMaximize',
  FULLSCREEN_EXIT: 'FireplaceMinimize',
  SPINNER: 'FireplaceSpinner'
};

const IMAGE_CONTAINER_CLASSES = {
  cover: 'fireplace-content__image--cover',
  contain: 'fireplace-content__image--contain'
};

const WRAPPER_CLASSES = {
  reveal: 'fireplace-reveal'
};

const validateLayoutProp = (layout) => {
  if (layout && !Object.keys(IMAGE_CONTAINER_CLASSES).includes(layout)) {
    throw new Meteor.Error('validation-error', `Invalid value for prop 'layout': '${layout}'. Was expecting 'cover' or 'contain'`);
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

const requestExitFullscreen = () => {
  debugger;
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
    imgEl.src = image.src;
  });
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
  this.autorun(() => console.log(`fullscreenActive: ${this.fullscreenActive.get()}`));

  /* Preload the initial images +1 from both directions */
  const startImage = images[startIndex];
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

    this.loading.set(true);
    preload(images[nextIndex]).then(() => {
      this.loading.set(false);
      this.currentIndex.set(nextIndex);
      preload(images[oneAfter]);
    });
    
  };

  this.enterFullsreen = async () => {    
    const wrapper = this.firstNode;
    requestFullscreen(wrapper).then((res, rej) => this.fullscreenActive.set(!rej));
    ;
  };

  this.exitFullScreen = () => {
    requestExitFullscreen().then(() => this.fullscreenActive.set(false));
  };
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

  spinnerTempl(customTemplate) {
    return customTemplate || DEFAULT_TEMPLATES.SPINNER;
  },

  fullscreenTmpl(customEnterTmpl, customExitTmpl) {
    const instance = Template.instance();
    if (instance.fullscreenActive.get()) {
      return customExitTmpl || DEFAULT_TEMPLATES.FULLSCREEN_EXIT;
    }
    return customEnterTmpl || DEFAULT_TEMPLATES.FULLSCREEN_ENTER;
  },

  imageContainerClass(layout) {
    if (layout) {
      return IMAGE_CONTAINER_CLASSES[layout];
    }
    return IMAGE_CONTAINER_CLASSES.contain;
  },

  overlayStyles(background) {
    return background ? `background: ${background};` : '';
  },

  imageContainerStyles(maxImageWidth) {
    const isContained = Template.currentData().layout === 'contain';
    return maxImageWidth && isContained ? `width: ${maxImageWidth}px` : '';
  },

  imageStyles(layout) {
    return layout ? `object-fit: ${layout};` : '';
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
    if (templateInstance.fullscreenActive.get()) {
      templateInstance.exitFullScreen()
    } else {
      templateInstance.enterFullsreen();
    }
  },
  'click .fireplace-close'(event, templateInstance) {
    templateInstance.firstNode.classList.remove(WRAPPER_CLASSES.reveal);
    Meteor.setTimeout(() => templateInstance.data.onCloseRequested(), 350);
  }
});