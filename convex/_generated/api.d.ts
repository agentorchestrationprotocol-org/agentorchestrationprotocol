/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as auth from "../auth.js";
import type * as blockchain from "../blockchain.js";
import type * as calibrations from "../calibrations.js";
import type * as claims from "../claims.js";
import type * as classifications from "../classifications.js";
import type * as comments from "../comments.js";
import type * as consensus from "../consensus.js";
import type * as deviceAuth from "../deviceAuth.js";
import type * as http from "../http.js";
import type * as observability from "../observability.js";
import type * as outputs from "../outputs.js";
import type * as policyDecisions from "../policyDecisions.js";
import type * as protocols from "../protocols.js";
import type * as registry from "../registry.js";
import type * as registryAction from "../registryAction.js";
import type * as rewards from "../rewards.js";
import type * as roleSlots from "../roleSlots.js";
import type * as saved from "../saved.js";
import type * as sbt from "../sbt.js";
import type * as stageEngine from "../stageEngine.js";
import type * as staking from "../staking.js";
import type * as users from "../users.js";
import type * as utils_agentModel from "../utils/agentModel.js";
import type * as utils_avatar from "../utils/avatar.js";
import type * as utils_commentTypes from "../utils/commentTypes.js";
import type * as utils_moderation from "../utils/moderation.js";
import type * as utils_names from "../utils/names.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  auth: typeof auth;
  blockchain: typeof blockchain;
  calibrations: typeof calibrations;
  claims: typeof claims;
  classifications: typeof classifications;
  comments: typeof comments;
  consensus: typeof consensus;
  deviceAuth: typeof deviceAuth;
  http: typeof http;
  observability: typeof observability;
  outputs: typeof outputs;
  policyDecisions: typeof policyDecisions;
  protocols: typeof protocols;
  registry: typeof registry;
  registryAction: typeof registryAction;
  rewards: typeof rewards;
  roleSlots: typeof roleSlots;
  saved: typeof saved;
  sbt: typeof sbt;
  stageEngine: typeof stageEngine;
  staking: typeof staking;
  users: typeof users;
  "utils/agentModel": typeof utils_agentModel;
  "utils/avatar": typeof utils_avatar;
  "utils/commentTypes": typeof utils_commentTypes;
  "utils/moderation": typeof utils_moderation;
  "utils/names": typeof utils_names;
  votes: typeof votes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workOSAuthKit: {
    lib: {
      enqueueWebhookEvent: FunctionReference<
        "mutation",
        "internal",
        {
          apiKey: string;
          event: string;
          eventId: string;
          eventTypes?: Array<string>;
          logLevel?: "DEBUG";
          onEventHandle?: string;
          updatedAt?: string;
        },
        any
      >;
      getAuthUser: FunctionReference<
        "query",
        "internal",
        { id: string },
        {
          createdAt: string;
          email: string;
          emailVerified: boolean;
          externalId?: null | string;
          firstName?: null | string;
          id: string;
          lastName?: null | string;
          lastSignInAt?: null | string;
          locale?: null | string;
          metadata: Record<string, any>;
          profilePictureUrl?: null | string;
          updatedAt: string;
        } | null
      >;
    };
  };
};
