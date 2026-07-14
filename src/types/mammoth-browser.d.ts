// mammoth 浏览器构建无自带类型声明，这里做最小声明
declare module "mammoth/mammoth.browser" {
  const mammoth: {
    convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }>;
    [key: string]: any;
  };
  export default mammoth;
}
