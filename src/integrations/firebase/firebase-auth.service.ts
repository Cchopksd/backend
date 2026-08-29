import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';
import type { FirebaseUser, VerifiedFirebaseToken } from './types/firebase-user.type.js';

function isFirebaseAuthError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';
}

@Injectable()
export class FirebaseAuthService {
  private app?: App;

  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
    try {
      const token = await this.auth.verifyIdToken(idToken, true);
      return this.mapToken(token);
    } catch (error: unknown) {
      throw new UnauthorizedException({ error: 'AUTH_INVALID_TOKEN', message: 'Invalid or expired Firebase ID token' }, { cause: error });
    }
  }

  async getOrCreateUserByVerifiedEmail(email: string): Promise<FirebaseUser> {
    try {
      return this.mapUser(await this.auth.getUserByEmail(email));
    } catch (error: unknown) {
      if (!isFirebaseAuthError(error) || error.code !== 'auth/user-not-found') {
        throw error;
      }
      return this.mapUser(await this.auth.createUser({ email, emailVerified: true }));
    }
  }

  async createCustomToken(uid: string): Promise<string> {
    return this.auth.createCustomToken(uid);
  }

  private get auth(): Auth {
    return getAuth(this.getApp());
  }

  private getApp(): App {
    if (this.app) return this.app;
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');
    const credential = projectId && clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault();
    this.app = getApps()[0] ?? initializeApp({ credential, projectId });
    return this.app;
  }

  private mapToken(token: DecodedIdToken): VerifiedFirebaseToken {
    return {
      uid: token.uid,
      email: token.email,
      emailVerified: token.email_verified,
      displayName: token.name,
      signInProvider: token.firebase.sign_in_provider,
    };
  }

  private mapUser(user: { uid: string; email?: string; emailVerified: boolean; displayName?: string }): FirebaseUser {
    return { uid: user.uid, email: user.email, emailVerified: user.emailVerified, displayName: user.displayName };
  }
}
