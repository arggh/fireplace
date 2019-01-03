import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';

// Variables exported by this module can be imported by other packages and
// applications. See fireplace-tests.js for an example of importing.
export const Fireplace = function ({
  images = [],
  layout = 'contain',
  background,
  maxImageWidth = 1300,
  startIndex = 0
}) {
  const target = document.body;
  let view;

  const props = {
    images,
    layout,
    background,
    maxImageWidth,
    startIndex,
    onCloseRequested: () => Blaze.remove(view)
  };
  
  view = Blaze.renderWithData(Template.Fireplace, props, target);
}
