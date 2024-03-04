import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot } from '@angular/router';
import { Observable, take } from 'rxjs';
import { AuthenticationService } from './authentication.service';
import { environment } from 'src/environments/environment';
import * as _ from 'lodash';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthenticationService) { }

  checkRoles(url: any, role: any) {
    var result = true;
    _.forEach(this.authService.RBACMap, (targetPaths, targetRole) => {
      _.forEach(targetPaths, p => {
        if (_.startsWith(url, p) && role !== targetRole) {
          result = false;
        }
      })
    })
    if (!environment.production) console.log(`[D] ${url} [${role}] ~ ${result}`);
    return result;
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return new Observable<boolean>(observer => {
      this.authService.isLoggedIn(state.url)
      .subscribe((val) => {
        if (val) {
          this.authService.sessionInfo$.pipe(take(1)).subscribe(sess => {
            var ok = this.checkRoles(state.url, sess.role);
            observer.next(ok);
            if (!ok) {
              window.location.href = '/members';
            }
          })
        }
        else {
          this.authService.markLoggedOut();
          observer.next(false);
        }
      })
    })
  }
}
