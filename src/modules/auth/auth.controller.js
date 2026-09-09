import { env } from '../../config/env.js';
import { created, ok } from '../../utils/core.js';
import { authService } from './auth.service.js';

function cookieOptions(){
  return {httpOnly:true,secure:env.COOKIE_SECURE,sameSite:env.COOKIE_SAME_SITE,
    domain:env.COOKIE_DOMAIN||undefined,path:'/api/auth',maxAge:env.REFRESH_TOKEN_DAYS*86400000};
}
const context=req=>({ip:req.ip,userAgent:req.get('user-agent')});

export const authController={
  register:async(req,res)=>{const data=await authService.register(req.body,context(req));res.cookie(env.COOKIE_NAME,data.refreshToken,cookieOptions());delete data.refreshToken;created(res,data);},
  login:async(req,res)=>{const data=await authService.login(req.body,context(req));res.cookie(env.COOKIE_NAME,data.refreshToken,cookieOptions());delete data.refreshToken;ok(res,data);},
  refresh:async(req,res)=>{const data=await authService.refresh(req.cookies?.[env.COOKIE_NAME],context(req));res.cookie(env.COOKIE_NAME,data.refreshToken,cookieOptions());delete data.refreshToken;ok(res,data);},
  logout:async(req,res)=>{const data=await authService.logout(req.cookies?.[env.COOKIE_NAME]);const {maxAge,...opts}=cookieOptions();res.clearCookie(env.COOKIE_NAME,opts);ok(res,data);},
  forgotPassword:async(req,res)=>ok(res,await authService.forgotPassword(req.body.email)),
  resetPassword:async(req,res)=>ok(res,await authService.resetPassword(req.body.token,req.body.password)),
  changePassword:async(req,res)=>{const data=await authService.changePassword(req.user.id,req.body.currentPassword,req.body.newPassword);const {maxAge,...opts}=cookieOptions();res.clearCookie(env.COOKIE_NAME,opts);ok(res,data);},
  me:async(req,res)=>ok(res,await authService.me(req.user)),
  acceptInvitation:async(req,res)=>{const data=await authService.acceptInvitation(req.body,context(req));res.cookie(env.COOKIE_NAME,data.refreshToken,cookieOptions());delete data.refreshToken;created(res,data);}
};
