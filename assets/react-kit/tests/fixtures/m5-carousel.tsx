import { createRoot } from "react-dom/client";
import { Carousel } from "../../src/personal-ui";
import "./m5-carousel.css";

const slides = [
  { id: "first", label: "First", content: <div className="slide"><strong>First slide</strong><button type="button">First slide action</button></div> },
  { id: "second", label: "Second", content: <div className="slide"><strong>Second slide</strong><button type="button">Second slide action</button></div> },
  { id: "third", label: "Third", content: <div className="slide"><strong>Third slide</strong><button type="button">Third slide action</button></div> },
];

createRoot(document.getElementById("root")!).render(
  <main>
    <Carousel ariaLabel="Manual highlights" slides={slides} />
    <Carousel ariaLabel="Auto highlights" slides={slides} autoplay loop interval={1500} />
    <Carousel ariaLabel="Empty highlights" slides={[]} autoplay loop />
  </main>,
);
