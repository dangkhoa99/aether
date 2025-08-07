import { ResultCodes } from '@/common';
import { BaseNetworkRequest } from '@/helpers/network';
import { getError } from '@/utilities';
import { AuthenticationStrategy, registerAuthenticationStrategy } from '@loopback/authentication';
import { Context } from '@loopback/core';
import { Request } from '@loopback/rest';
import { securityId } from '@loopback/security';
import isEmpty from 'lodash/isEmpty';

class AuthProviderNetworkRequest extends BaseNetworkRequest {}

export const defineOAuth2Strategy = (opts: {
  name: string;
  baseURL: string;
  authPath?: string;
}) => {
  class Strategy implements AuthenticationStrategy {
    name = opts.name;

    authProvider: AuthProviderNetworkRequest;
    authPath: string;

    constructor() {
      const baseUrl = opts.baseURL;
      if (!baseUrl || isEmpty(baseUrl)) {
        throw getError({
          message: `[RemoteAuthenticationStrategy][DANGER] INVALID baseURL | Missing env: APP_ENV_REMOTE_AUTH_SERVER_URL`,
        });
      }

      this.authPath = opts.authPath ?? '/auth/who-am-i';

      this.authProvider = new AuthProviderNetworkRequest({
        name: AuthProviderNetworkRequest.name,
        scope: `${Strategy.name}_${opts.name}`,
        networkOptions: { baseUrl },
      });
    }

    async authenticate(request: Request) {
      const networkService = this.authProvider.getNetworkService();

      if (!request.headers['authorization']) {
        throw getError({
          statusCode: ResultCodes.RS_4.Unauthorized,
          message: 'No authorization token',
        });
      }

      const rs = await networkService.send({
        url: this.authProvider.getRequestUrl({ paths: [this.authPath] }),
        headers: { Authorization: request.headers['authorization'] },
      });

      if (rs?.data?.error) {
        throw getError(rs.data.error);
      }

      return { ...rs?.data, [securityId]: rs?.data?.userId?.toString() };
    }
  }

  return Strategy;
};

export const registerOAuth2Strategy = (
  context: Context,
  options: {
    strategyName: string;
    authenticateUrl: string;
    authenticatePath?: string;
  },
) => {
  const remoteOAuth2Strategy = defineOAuth2Strategy({
    name: options.strategyName,
    baseURL: options.authenticateUrl,
    authPath: options.authenticatePath ?? '/auth/who-am-i',
  });
  registerAuthenticationStrategy(context, remoteOAuth2Strategy);
};
