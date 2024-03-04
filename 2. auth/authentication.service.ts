import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { NavigationExtras, Router } from '@angular/router';
import { BehaviorSubject, Subject, Subscription, catchError, distinctUntilChanged, interval, Observable, of, ReplaySubject, debounceTime } from 'rxjs';
import { StorageMap } from '@ngx-pwa/local-storage';
import { sha512 } from 'js-sha512';
import * as _ from 'lodash';
// import * as moment from 'moment';
import { duration, unix, now } from 'moment';
import jwt_decode from 'jwt-decode';

export type SessionInfo = {
  username: string;
  email: string;
  userId: number;
  role: Role;
  roleId: number;
  roleZh: string;
  tenant: string;
  tenantId: number;
  expiry: number;
  rbac: any,
  env: any,
}

export type Role = 'admin' | 'sales' | 'audit' | 'WTF';

export type PermissionScope = {
  roleId: number;
  menuName: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService implements OnDestroy {

  subscriptions: any = [];

  RBACMap = {
    'admin': ['/settings/', '/poi/']
  }

  isAdmin = false;

  private _showLoginOut = new BehaviorSubject<boolean>(false);
  public readonly showLoginOut$ = this._showLoginOut.asObservable();

  private _timeToExpire = new Subject<string>();
  public readonly timeToExpire$ = this._timeToExpire.asObservable();

  private sub1!: Subscription;
  private sub60!: Subscription;

  private __sessionInfo!: SessionInfo;
  private _sessionInfo = new ReplaySubject<SessionInfo>();
  public readonly sessionInfo$ = this._sessionInfo.asObservable().pipe(debounceTime(10));

  private _rolesPermissions = new ReplaySubject<any>();
  public readonly rolesPermissions$ = this._rolesPermissions.asObservable();

  getHash(s: string) {
    return sha512(s);
  }

  showLoginOut() { this._showLoginOut.next(true); }

  hideLoginOut() { this._showLoginOut.next(false); }

  token2Json(token: any): any {
    try {
      return jwt_decode(token);
    }
    catch { return {} }
  }

  // getTokenProp(token: any, prop: string) {
  //   try {
  //     var a = atob((token as string).split('.')[1]);
  //     return _.get(JSON.parse(a), prop, '');
  //   }
  //   catch { return ''; }
  // }
  // atob doesn't work when contents contain utf8-characters (ex. Chinese characters)
  // https://stackoverflow.com/questions/48075688/how-to-decode-the-jwt-encoded-token-payload-on-client-side-in-angular

  constructor(private storage: StorageMap, private router: Router, private http: HttpClient) {
    this.storage.get('session').pipe(distinctUntilChanged()).subscribe(val => {
      if (val) {
        var j = this.token2Json(val);
        this.__sessionInfo = {
          username: _.get(j, 'name'),
          email: _.get(j, 'email'),
          userId: _.get(j, 'sub') as number,
          roleId: _.get(j, 'roleId') as number,
          roleZh: _.get(j, 'role'),
          tenant: _.get(j, 'tenant'),
          tenantId: _.get(j, 'tenantId') as number,
          expiry: _.get(j, 'exp') as number,
          role: 'WTF',
          rbac: _.get(j, 'rbac') as any,
          env: _.get(j, 'env') as any,
        }
        switch(this.__sessionInfo.roleZh) {
          case '系統管理者':
            this.isAdmin = true;
            this.__sessionInfo.role = 'admin';
            break;
          case '業務窗口':
            this.__sessionInfo.role = 'sales';
            break;
          case '審核者':
            this.__sessionInfo.role = 'audit';
            break;
          default:
            this.__sessionInfo.role = 'WTF';
            console.log('WFT role', this.__sessionInfo.roleZh);
            break;
        }
        this._sessionInfo.next(this.__sessionInfo);
        this._rolesPermissions.next(this.__sessionInfo.rbac);
      }
    })
    this.sub1 = interval(1000).subscribe(() => {
      if (this.__sessionInfo) {
        var d = duration(unix(this.__sessionInfo.expiry).diff(now()));
        if (d.asMilliseconds() > 0) {
          this._timeToExpire.next(`${d.hours() < 10 ? '0' + d.hours() : d.hours()}:${d.minutes() < 10 ? '0' + d.minutes() : d.minutes()}:${d.seconds() < 10 ? '0' + d.seconds() : d.seconds()}`);
        }
      }
    })
    this.sub60 = interval(60 * 1000).subscribe(() => {  // synchronize heap-token with storage-token
      this.storage.get('session').pipe(distinctUntilChanged()).subscribe(val => {
        if (val && this.__sessionInfo) {
          var newExp = _.get(this.token2Json(val), 'exp') as number;
          this.__sessionInfo.expiry = newExp;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.sub1.unsubscribe();
    this.sub60.unsubscribe();

    while (this.subscriptions.length) {
      var s = this.subscriptions.pop();
      if (s.unsubscribe) {
        s.unsubscribe();
      }
    }
  }

  checkAuth() {
    return this.http.get('/api/status/auth').pipe(catchError(() => { return of(false) }));
  }

  isLoggedIn(path?: string) {
    return new Observable<boolean>(observer => {
      this.getSessionToken().subscribe(session => {
        if (!session) {
          observer.next(false);
        }
        this.checkAuth().subscribe(token => {
          if (!token) {
            observer.next(false);
          }
          observer.next(true);
        })
      })
    })
  }

  markLoggedIn(token: any) {
    return this.setSessionToken(token);
  }

  markLoggedOut(toastMessage?: any) {
    this.subscriptions.push(
      this.storage.delete('session').pipe(debounceTime(1000)).subscribe(() => {
        if (this.__sessionInfo != undefined) {
          this.__sessionInfo.email = '';
        }
        this._sessionInfo.next(this.__sessionInfo);
        if (toastMessage) {
          this.router.navigate(['/auth/login'], { message: toastMessage } as NavigationExtras);
        }
        else {
          window.location.href = '/auth/login';
        }
      })
    );
  }

  /** Returns the session token stored in local-storage */
  getSessionToken() {
    return this.storage.get('session');
  }

  /** Writes token as 'session' in local-storage */
  setSessionToken(token: any) {
    return this.storage.set('session', token);
  }

  clearSessionToken() {
    return this.storage.delete('session');
  }

  setLastLoginEmail(email: string) {
    return this.storage.set('lastLogin', email);
  }

  getLastLoginEmail() {
    return this.storage.get('lastLogin');
  }

  clearLastLoginEmail() {
    return this.storage.delete('lastLogin');
  }

  getRemoteAuthInfo() {
    return this.http.get('/api/auth/info');
  }
}
