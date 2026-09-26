import {applicationApi} from '@/server/application-api';
import type {NextRequest} from 'next/server';
export const runtime='nodejs';
const handle=(req:NextRequest,ctx:{params:Promise<{path:string[]}>})=>applicationApi(req,ctx);
export {handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE};
