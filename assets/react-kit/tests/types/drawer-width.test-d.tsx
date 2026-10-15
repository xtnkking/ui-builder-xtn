import { Drawer } from "../../src/ui";

const baseProps = {
  open: false,
  onOpenChange: () => undefined,
  title: "抽屉",
  children: "内容",
};

const supportedWidths = <>
  <Drawer {...baseProps} width="medium" />
  <Drawer {...baseProps} width="large" />
  <Drawer {...baseProps} width={800} />
  <Drawer {...baseProps} width="960px" />
  <Drawer {...baseProps} width="75%" />
  <Drawer {...baseProps} width="80vw" />
  <Drawer {...baseProps} width={800} variant="inset" fullScreen />
  <Drawer {...baseProps} fullScreen={false} />
</>;

// @ts-expect-error Arbitrary CSS expressions are not public widths.
const expressionWidth = <Drawer {...baseProps} width="calc(100% - 20px)" />;
// @ts-expect-error The public width units are px, %, and vw only.
const unsupportedUnit = <Drawer {...baseProps} width="60rem" />;
// @ts-expect-error Width does not accept a style object.
const objectWidth = <Drawer {...baseProps} width={{ width: 800 }} />;
// @ts-expect-error Full-screen mode is an explicit boolean.
const stringFullScreen = <Drawer {...baseProps} fullScreen="true" />;
// @ts-expect-error Custom width does not permit style overrides.
const consumerStyle = <Drawer {...baseProps} width={800} style={{ width: "1200px" }} />;
// @ts-expect-error Custom width does not permit application classes.
const consumerClass = <Drawer {...baseProps} width="75%" className="foreign" />;

void supportedWidths;
void expressionWidth;
void unsupportedUnit;
void objectWidth;
void stringFullScreen;
void consumerStyle;
void consumerClass;
