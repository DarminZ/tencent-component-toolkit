import { ActionType } from './apis';
import { CapiCredentials, RegionType, ApiServiceType } from './../interface';
import { Capi } from '@tencent-sdk/capi';
import APIS from './apis';
import { getYunTiApiUrl } from '../../utils';
import axios from 'axios';

/** CAM （访问管理）for serverless */
export default class Cam {
  region: RegionType;
  credentials: CapiCredentials;
  capi: Capi;

  constructor(credentials: CapiCredentials, region: RegionType = 'ap-guangzhou') {
    this.region = region;
    this.credentials = credentials;

    this.capi = new Capi({
      Region: this.region,
      ServiceType: ApiServiceType.cam,
      SecretId: this.credentials.SecretId!,
      SecretKey: this.credentials.SecretKey!,
      Token: this.credentials.Token,
    });
  }

  async request({ Action, ...data }: { Action: ActionType; [key: string]: any }) {
    const result = await APIS[Action](this.capi, data);
    return result;
  }

  /** 获取角色列表  */
  async DescribeRoleList(page: number, limit: number) {
    const reqParams = {
      Action: 'DescribeRoleList' as const,
      Page: page,
      Rp: limit,
    };
    return this.request(reqParams);
  }

  async ListRolePoliciesByRoleId(roleId: string, page: number, limit: number) {
    const reqParams = {
      Action: 'ListAttachedRolePolicies' as const,
      Page: page,
      Rp: limit,
      RoleId: roleId,
    };
    return this.request(reqParams);
  }

  /** 创建角色 */
  async CreateRole(
    roleName: string,
    policiesDocument: string,
    description = 'Created By Serverless',
  ) {
    const reqParams = {
      Action: 'CreateRole' as const,
      RoleName: roleName,
      PolicyDocument: policiesDocument,
      Description: description,
    };
    return this.request(reqParams);
  }

  /** 获取角色 */
  async GetRole(roleName: string) {
    return this.request({
      Action: 'GetRole',
      RoleName: roleName,
    });
  }

  /** 删除角色 */
  async DeleteRole(roleName: string) {
    return this.request({
      Action: 'DeleteRole',
      RoleName: roleName,
    });
  }

  /**
   * 为角色添加策略名称
   * api limit qps 3/s
   */
  async AttachRolePolicyByName(roleId: string, policyName: string) {
    const reqParams = {
      Action: 'AttachRolePolicy' as const,
      AttachRoleId: roleId,
      PolicyName: policyName,
    };
    return this.request(reqParams);
  }

  /**
   * 角色是否存在
   * @param roleName 角色名称
   */
  async isRoleExist(roleName: string) {
    const { List = [] } = await this.DescribeRoleList(1, 200);

    for (var i = 0; i < List.length; i++) {
      const roleItem = List[i];

      if (roleItem.RoleName === roleName) {
        return true;
      }
    }
    return false;
  }

  /** 检查角色是否有云函数权限 */
  async CheckSCFExcuteRole() {
    return this.isRoleExist('QCS_SCFExcuteRole');
  }

  /** 查询用户AppId */
  async GetUserAppId(): Promise<{ OwnerUin: string; AppId: string; Uin: string }> {
    try {
      return this.request({
        Action: 'GetUserAppId',
      });
    } catch (error) {
      return {
        OwnerUin: '',
        AppId: '',
        Uin: '',
      };
    }
  }

  /**
   * checkYunTi 检查是否是云梯账号
   * @returns {boolean} true: 是云梯账号; false: 非云梯账号
   */
  async checkYunTi(): Promise<boolean> {
    let isYunTi = false;
    const { OwnerUin: uin } = await this.GetUserAppId();
    try {
      const params = JSON.stringify({
        id: '1',
        jsonrpc: '2.0',
        method: 'checkOwnUin',
        params: { ownUin: [uin] },
      });
      const apiUrl = getYunTiApiUrl();
      const res = await axios.post(apiUrl, params, {
        headers: { 'content-type': 'application/json' },
      });
      if (res?.data?.error?.message) {
        throw new Error(res.data.error.message);
      } else {
        isYunTi =
          res?.data?.result?.data &&
          res.data.result.data?.some(
            (item: { ownUin: string; appId: string }) => item?.ownUin === uin,
          );
        console.log('check yunTi ownUin:', isYunTi);
      }
    } catch (error) {
      isYunTi = false;
      console.log('checkYunTiOwnUin error:', error);
    }
    return isYunTi;
  }
}
