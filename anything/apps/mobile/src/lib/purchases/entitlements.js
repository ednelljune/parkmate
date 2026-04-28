import {
  PRO_ENTITLEMENT_ID,
  PRO_LAUNCH_PRICE_LABEL,
  PRO_PRODUCT_ID,
} from './config';

const LIFETIME_PACKAGE_IDENTIFIER = '$rc_lifetime';
const LIFETIME_PACKAGE_TYPE = 'LIFETIME';

export const hasProEntitlement = (customerInfo) =>
  Boolean(customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID]);

export const getProEntitlement = (customerInfo) =>
  customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID] ?? null;

export const getCurrentOffering = (offerings) => offerings?.current ?? null;

export const getProPackage = (offerings) => {
  const currentOffering = getCurrentOffering(offerings);
  const availablePackages = Array.isArray(currentOffering?.availablePackages)
    ? currentOffering.availablePackages
    : [];

  return (
    currentOffering?.lifetime ||
    availablePackages.find(
      (candidate) =>
        candidate?.identifier === LIFETIME_PACKAGE_IDENTIFIER ||
        candidate?.packageType === LIFETIME_PACKAGE_TYPE,
    ) ||
    availablePackages.find(
      (candidate) => candidate?.product?.identifier === PRO_PRODUCT_ID,
    ) ||
    null
  );
};

export const getProPriceLabel = (proPackage) =>
  proPackage?.product?.priceString ||
  proPackage?.storeProduct?.priceString ||
  PRO_LAUNCH_PRICE_LABEL;

