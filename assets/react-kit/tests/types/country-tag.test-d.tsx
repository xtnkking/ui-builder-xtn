import { Tag, type CountryTagData, type TagProps } from "../../src/ui";

const country: CountryTagData = { code: "GB", name: "英国", callingCode: "+44" };
const props: TagProps = { country, tone: "blue", selected: true };
<Tag {...props} />;
<Tag country={{ code: "AS", name: "美属萨摩亚", flagSrc: "/flags/as.png" }} />;
<Tag leading="★">普通标签</Tag>;
// @ts-expect-error Country content owns the label.
<Tag country={country}>重复标签</Tag>;
// @ts-expect-error The dedicated country flag owns the leading slot.
<Tag country={country} leading="★" />;
// @ts-expect-error Country name is required.
<Tag country={{ code: "GB" }} />;
// @ts-expect-error Canonical geometry cannot be overridden.
<Tag country={country} style={{ width: 500 }} />;
