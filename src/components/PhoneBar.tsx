import { LiveBft } from "./LiveBft";

/** The top bar of the phone pages: where you are, plus the live BFT face. */
export function PhoneBar({ right }: { right: string }) {
  return (
    <div className="phonebar">
      <div className="bar0"><span>frens.earth · Machines</span><span>{right}</span></div>
      <div className="phoneclock"><LiveBft /></div>
    </div>
  );
}
