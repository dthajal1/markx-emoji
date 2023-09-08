// Copyright Abridged, Inc. 2023. All Rights Reserved.
// Node module: @collabland/example-hello-action
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { Component } from '@loopback/core';
import { ImagesController } from './controllers/images.controller.js';
import { MarkXActionController } from './controllers/markx-action.controller.js';
import { OAuth2Controller } from './controllers/oauth.controller.js';

/**
 * Register all services including command handlers, job runners and services
 */
export class MarkXActionComponent implements Component {
  controllers = [MarkXActionController, ImagesController, OAuth2Controller];
}
