// Copyright Abridged, Inc. 2023. All Rights Reserved.
// Node module: @collabland/example-hello-action
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { getEnvVar, getEnvVarAsNumber } from '@collabland/common';
import { ApplicationConfig } from '@loopback/core';
import { RestApplication } from '@loopback/rest';
import AWS from "aws-sdk";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { MarkXActionComponent } from './component.js';
import { dbConnect } from './datasources/db.datasource.js';
dotenv.config();

/**
 * A demo application to expose REST APIs for Hello action
 */
export class MarkXActionApplication extends RestApplication {
  constructor(config?: ApplicationConfig) {
    super(MarkXActionApplication.resolveConfig(config));
    this.component(MarkXActionComponent);
    const dir = fileURLToPath(new URL('../public', import.meta.url));
    this.static('/', dir);

    // application configs
    dbConnect()
      .then(() => console.log("database connected successfully!"))
      .catch((err) => console.log("err: ", err))

    AWS.config.update({
      accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID'),
      secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY'),
      region: getEnvVar('S3_REGION')
    });
  }

  private static resolveConfig(config?: ApplicationConfig): ApplicationConfig {
    return {
      ...config,
      rest: {
        port: getEnvVarAsNumber('PORT', 3000),
        host: getEnvVar('HOST'),
        ...config?.rest,
      },
    };
  }
}
